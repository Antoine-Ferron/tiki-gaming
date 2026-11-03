import { CONFIG, FIXED_DT } from './config'

/** A simulation system, stepped at a fixed rate outside of React. */
export interface System {
  name: string
  /** Fixed-step logic update. */
  update?(dt: number): void
  /** Per-render-frame update; alpha ∈ [0,1) is the interpolation factor between ticks. */
  render?(alpha: number, frameDt: number): void
}

/**
 * Fixed-timestep game loop (accumulator pattern).
 * Driven by R3F's useFrame through <GameLoop/>, but independent from React so it can be unit-tested.
 */
export class GameLoop {
  private systems: System[] = []
  private accumulator = 0
  ticks = 0
  timeScale = 1
  paused = false

  add(system: System): () => void {
    this.systems.push(system)
    return () => this.remove(system)
  }

  remove(system: System): void {
    this.systems = this.systems.filter((s) => s !== system)
  }

  /** Advance by a real frame duration (seconds). Returns the number of fixed ticks executed. */
  advance(frameDt: number): number {
    const dt = Math.min(frameDt, CONFIG.maxFrameTime) * (this.paused ? 0 : this.timeScale)
    this.accumulator += dt
    let steps = 0
    while (this.accumulator >= FIXED_DT) {
      for (const s of this.systems) s.update?.(FIXED_DT)
      this.accumulator -= FIXED_DT
      this.ticks++
      steps++
    }
    const alpha = this.accumulator / FIXED_DT
    for (const s of this.systems) s.render?.(alpha, dt)
    return steps
  }
}

export const gameLoop = new GameLoop()
