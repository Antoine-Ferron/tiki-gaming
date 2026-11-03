import * as z from 'zod/mini'
import type { GameContext } from '../../types'
import type { Move } from '../domain/board'
import { recordResult } from '../domain/progress'
import { levelScore, totalScore } from '../domain/score'

/** Sauvegarde du jeu (game_saves.data) : les records par niveau. Une sauvegarde d'un autre format est ignorée. */
const saveSchema = z.object({
  version: z.literal(1),
  best: z.record(z.string(), z.number()),
})

export interface FinishedLevel {
  level: number
  /** Nombre minimal de coups du niveau. */
  optimal: number
  moves: Move[]
  hintsUsed: number
  durationMs: number
}

/**
 * Fin d'un niveau : calcule son score et met à jour le record. Seulement si le record change, sauvegarde la
 * progression et envoie le score total (colonne score) avec le détail de la partie (metadata).
 */
export async function completeLevel(ctx: GameContext, run: FinishedLevel) {
  const saved = await ctx.loadSave(saveSchema)
  const score = levelScore({ moves: run.moves.length, optimal: run.optimal, hintsUsed: run.hintsUsed })
  const { best, improved } = recordResult(saved?.best ?? {}, run.level, score)

  if (improved) {
    await ctx.save({ version: 1, best })
    await ctx.submitScore(totalScore(best), {
      level: run.level,
      levelScore: score,
      hintsUsed: run.hintsUsed,
      durationMs: run.durationMs,
      moves: run.moves.map((m) => ({ id: m.id, delta: m.delta })),
    })
  }
  return { score, best, improved }
}
