/**
 * Score de LemurTiki (EF-6.4, EF-6.5).
 */
import { type GameState, PX_PER_METER } from './game'

/** Score maximal accepté par la plateforme (games.max_score). */
export const MAX_SCORE = 100_000
const POINTS_PER_VANILLA = 10

/** Mètres entiers atteints + 10 points par gousse de vanille, sans dépasser le maximum. */
export function score(state: GameState): number {
  const meters = Math.floor(state.peakY / PX_PER_METER)
  return Math.min(MAX_SCORE, meters + POINTS_PER_VANILLA * state.vanilla)
}
