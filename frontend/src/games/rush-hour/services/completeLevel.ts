import { GameError } from '../../errors'
import type { GameContext } from '../../types'
import type { Move } from '../domain/board'
import { recordResult } from '../domain/progress'
import { levelScore, totalScore } from '../domain/score'
import { loadProgress, saveProgress } from './progress'

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
  const progress = await loadProgress(ctx)
  const { best, improved } = recordResult(progress.best, run.level, score)

  if (improved) {
    const save = () => saveProgress(ctx, { ...progress, best })
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
      if (err instanceof GameError && err.code === 'queued') await save()
      throw err
    }
    await save()
  }
  return { score, best, improved }
}
