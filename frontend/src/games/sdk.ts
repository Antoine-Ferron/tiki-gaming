import type { Json } from '@/lib/database.types'
import { logger } from '@/lib/logger'
import { checkScore } from './domain/score'
import { GameError, MESSAGES, toGameError } from './errors'
import { localSaves } from './adapters/local'
import type { KeyValueStorage, SaveStore, ScoreRepository } from './ports'
import { createScoreQueue, type ScoreQueue } from './scoreQueue'
import type { GameContext, GameDefinition, Player, SaveSchema } from './types'

/**
 * Dépendances du contexte de jeu (ports). En production : `platformDeps()` (./adapters), branché par GamePage ;
 * dans les tests : `fakeDeps()` (./testing/fakes). Ce module n'importe aucun adaptateur d'infrastructure.
 */
export type GameDeps = {
  scores: ScoreRepository
  /** Sauvegarde du joueur connecté. */
  playerSaves: (playerId: string) => SaveStore
  /** Stockage de l'appareil : sauvegarde invitée et scores en attente. null = indisponible. */
  storage: KeyValueStorage | null
}

type GameInfo = Pick<GameDefinition, 'slug' | 'scoreLimits'>

export function createGameContext(game: GameInfo, player: Player | null, deps: GameDeps): GameContext {
  return player ? createPlayerContext(game, player, deps) : createGuestContext(game, deps)
}

/** Valide une sauvegarde avec le schéma du jeu : une sauvegarde corrompue ou d'une ancienne version donne null. */
function parseSave<T extends Json>(gameSlug: string, data: Json | null, schema?: SaveSchema<T>): T | null {
  if (data === null || !schema) return data as T | null
  const result = schema.safeParse(data)
  if (result.success) return result.data
  // Stryker disable next-line all: journalisation seule
  logger.warn({ gameSlug }, 'Sauvegarde ignorée : elle ne correspond pas au schéma du jeu')
  return null
}

function scoreError(score: number, game: GameInfo): GameError | null {
  const problem = checkScore(score, game.scoreLimits)
  return problem ? new GameError('invalid', problem) : null
}

function createPlayerContext(game: GameInfo, player: Player, deps: GameDeps): GameContext {
  const { scores } = deps
  const saves = deps.playerSaves(player.id)
  const queue: ScoreQueue | null = deps.storage && createScoreQueue(deps.storage, `tiki:pending-scores:${player.id}`)
  const sendPending = async () => {
    await queue?.flush((p) => scores.insert(p.gameSlug, p.score, p.metadata))
  }

  // Un score resté en attente d'une session précédente part dès l'ouverture du jeu (flush ne rejette jamais).
  void sendPending()

  return {
    gameSlug: game.slug,
    player,
    isGuest: false,

    async submitScore(score, metadata = {}) {
      const invalid = scoreError(score, game)
      if (invalid) throw invalid
      await sendPending()
      try {
        await scores.insert(game.slug, score, metadata)
        return true
      } catch (err) {
        const error = toGameError(err)
        if (!error.retryable || !queue) throw error
        queue.add({ gameSlug: game.slug, score, metadata })
        throw new GameError('queued', MESSAGES.queued, { cause: err })
      }
    },

    getLeaderboard: (limit = 10) => scores.leaderboard(game.slug, limit),
    getMyBest: () => scores.best(game.slug, player.id),

    async loadSave<T extends Json = Json>(schema?: SaveSchema<T>) {
      return parseSave(game.slug, await saves.load(game.slug), schema)
    },
    save: (data) => saves.save(game.slug, data),
    clearSave: () => saves.clear(game.slug),
  }
}

function createGuestContext(game: GameInfo, deps: GameDeps): GameContext {
  const saves = localSaves(deps.storage)

  return {
    gameSlug: game.slug,
    player: null,
    isGuest: true,

    async submitScore(score) {
      const invalid = scoreError(score, game)
      if (invalid) throw invalid
      return false
    },

    getLeaderboard: (limit = 10) => deps.scores.leaderboard(game.slug, limit),
    getMyBest: async () => null,

    async loadSave<T extends Json = Json>(schema?: SaveSchema<T>) {
      return parseSave(game.slug, await saves.load(game.slug), schema)
    },
    save: (data) => saves.save(game.slug, data),
    clearSave: () => saves.clear(game.slug),
  }
}
