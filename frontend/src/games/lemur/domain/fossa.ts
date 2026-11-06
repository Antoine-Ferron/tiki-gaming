/**
 * La fossa (EF-5) : elle monte sans cesse sous le maki et accélère avec la hauteur atteinte.
 */
import { type GameState, PX_PER_METER, STEP_S } from './game'

/** 4 m/s au départ, +1,2 m/s tous les 100 m atteints, au plus 20 m/s (EF-5.2) ; en px/s. */
const SPEED = { start: 40, gain: 12, every: 100 * PX_PER_METER, max: 200 }
/** Retard maximal sous le bas de l'écran (EF-5.3). */
const MAX_LAG = 40 * PX_PER_METER

/** Vitesse de la fossa, en px/s, quand le maki a atteint la hauteur `height` (px). */
export function fossaSpeed(height: number): number {
  const steps = Math.floor(height / SPEED.every)
  return Math.min(SPEED.max, SPEED.start + SPEED.gain * steps)
}

/** Fait monter la fossa d'une image, sans la laisser à plus de 40 m sous l'écran. */
export function chase(state: GameState): GameState {
  const climbed = state.fossaY + fossaSpeed(state.peakY) * STEP_S
  return { ...state, fossaY: Math.max(climbed, state.cameraY - MAX_LAG) }
}
