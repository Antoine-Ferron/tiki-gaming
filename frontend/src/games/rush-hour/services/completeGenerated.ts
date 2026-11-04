import type { GameContext } from '../../types'
import type { Difficulty } from '../domain/difficulty'
import { loadProgress, saveProgress } from './progress'

/**
 * Fin d'un plateau généré : met à jour les statistiques de sa difficulté (plateaux réussis, meilleur score).
 * Ne passe jamais par le classement : on pourrait sinon gonfler son score total en jouant à l'infini (S4).
 */
export async function completeGenerated(ctx: GameContext, run: { difficulty: Difficulty; score: number }) {
  const progress = await loadProgress(ctx)
  const previous = progress.generated?.[run.difficulty] ?? { won: 0, best: 0 }
  const stats = { won: previous.won + 1, best: Math.max(previous.best, run.score) }
  await saveProgress(ctx, { ...progress, generated: { ...progress.generated, [run.difficulty]: stats } })
  return stats
}
