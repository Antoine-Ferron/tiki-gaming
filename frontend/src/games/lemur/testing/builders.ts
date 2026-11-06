import { type GameState } from '../domain/game'

/** Partie de test au pied du baobab, sans branche ; chaque test ne précise que ce qui compte pour lui. */
export function aGame(overrides: Partial<GameState> = {}): GameState {
  return {
    maki: { x: 180, y: 0, vy: 0 },
    branches: [],
    cameraY: 0,
    peakY: 0,
    fossaY: 0,
    vanilla: 0,
    over: null,
    ...overrides,
  }
}
