import { GameError } from '../../errors'
import type { GameContext } from '../../types'
import type { Move } from '../domain/board'
import { recordResult } from '../domain/progress'
import { levelScore, totalScore } from '../domain/score'
import { loadBest } from './progress'

export interface FinishedLevel {
  level: number
  /** Nombre minimal de coups du niveau. */
  optimal: number
  moves: Move[]
  hintsUsed: number
  durationMs: number
}

/**
 * Fin d'un niveau : calcule son score et met à jour le record. Seulement si le record change, envoie le score
 * total (colonne score) avec le détail de la partie (metadata), puis sauvegarde la progression.
 */
export async function completeLevel(ctx: GameContext, run: FinishedLevel) {
  const score = levelScore({ moves: run.moves.length, optimal: run.optimal, hintsUsed: run.hintsUsed })
  const { best, improved } = recordResult(await loadBest(ctx), run.level, score)

  if (improved) {
    const saveProgress = () => ctx.save({ version: 1, best })
    // Le score part avant la sauvegarde : si l'envoi échoue, le record n'est pas enregistré et rejouer le
    // niveau renverra le score. Exception : une coupure réseau, où le SDK garde le score pour plus tard.
    try {
      await ctx.submitScore(totalScore(best), {
        level: run.level,
        levelScore: score,
        hintsUsed: run.hintsUsed,
        durationMs: run.durationMs,
        moves: run.moves.map((m) => ({ id: m.id, delta: m.delta })),
      })
    } catch (err) {
      if (err instanceof GameError && err.code === 'queued') await saveProgress()
      throw err
    }
    await saveProgress()
  }
  return { score, best, improved }
}
