/**
 * Début de partie (EF-1.1, EF-5.1).
 */
import { growBranches, type Random } from './branches'
import { BRANCH_HEIGHT, BRANCH_WIDTH, type GameState, PX_PER_METER, WORLD_WIDTH } from './game'

/** La fossa part au plus loin qu'elle puisse être : 40 m sous le bas de l'écran (EF-5.1, EF-5.3). */
const FOSSA_START = -40 * PX_PER_METER

/** Nouvelle partie : le maki sur une branche centrée au pied du baobab, la fossa sous l'écran. */
export function createGame(random: Random): GameState {
  const center = WORLD_WIDTH / 2
  const ground = { x: center - BRANCH_WIDTH / 2, y: -BRANCH_HEIGHT }
  const start: GameState = {
    maki: { x: center, y: 0, vy: 0 },
    branches: [ground],
    cameraY: 0,
    peakY: 0,
    fossaY: FOSSA_START,
    vanilla: 0,
    over: null,
  }
  return growBranches(start, random)
}
