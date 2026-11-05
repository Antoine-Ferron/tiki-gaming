/**
 * Début de partie (EF-1.1, EF-5.1).
 */
import type { Random } from './branches'
import type { GameState } from './game'

/** Nouvelle partie : le maki sur une branche centrée au pied du baobab, la fossa sous l'écran. */
export function createGame(_random: Random): GameState {
  return { maki: { x: 0, y: 0, vy: 0 }, branches: [], cameraY: 0, peakY: 0, fossaY: 0, vanilla: 0, over: null }
}
