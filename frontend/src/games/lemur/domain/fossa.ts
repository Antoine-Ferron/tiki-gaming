/**
 * La fossa (EF-5) : elle monte sans cesse sous le maki et accélère avec la hauteur atteinte.
 */
import { type GameState } from './game'

/** Vitesse de la fossa, en px/s, quand le maki a atteint la hauteur `height` (px). */
export function fossaSpeed(_height: number): number {
  return 0
}

/** Fait monter la fossa d'une image. */
export function chase(state: GameState): GameState {
  return state
}
