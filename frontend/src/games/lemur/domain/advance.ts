/**
 * Une image complète de la partie : physique, branches, fossa, puis fin de partie (EF-6).
 */
import { growBranches, type Random } from './branches'
import { chase } from './fossa'
import { type GameOver, type GameState, type Input, MAKI_SIZE, step } from './game'

/** Avance la partie d'une image ; une partie terminée ne bouge plus (EF-6.3). */
export function advance(state: GameState, input: Input, random: Random): GameState {
  if (state.over) return state
  const next = chase(growBranches(step(state, input), random))
  return { ...next, over: endingOf(next) }
}

function endingOf(state: GameState): GameOver | null {
  const { maki } = state
  if (maki.y + MAKI_SIZE < state.cameraY) return 'fall'
  if (state.fossaY >= maki.y) return 'fossa'
  return null
}
