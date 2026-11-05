/**
 * Score de LemurTiki (EF-6.4, EF-6.5).
 */
import { type GameState } from './game'

/** Score maximal accepté par la plateforme (games.max_score). */
export const MAX_SCORE = 100_000

/** Points de la partie. */
export function score(_state: GameState): number {
  return 0
}
