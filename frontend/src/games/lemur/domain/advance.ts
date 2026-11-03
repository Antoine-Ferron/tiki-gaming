/**
 * Une image complète de la partie : physique, branches, fossa, puis fin de partie (EF-6).
 */
import { type Random } from './branches'
import { type GameState, type Input } from './game'

/** Avance la partie d'une image ; une partie terminée ne bouge plus. */
export function advance(state: GameState, _input: Input, _random: Random): GameState {
  return state
}
