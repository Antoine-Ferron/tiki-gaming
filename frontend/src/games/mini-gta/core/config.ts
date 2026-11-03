/** Global constants shared by every system. */
export const CONFIG = {
  /** Simulation frequency of the fixed-step loop (Hz). */
  tickRate: 60,
  /** Upper bound on simulated time per rendered frame, avoids the "spiral of death". */
  maxFrameTime: 0.25,
  /** Default world seed: same seed → same city, vehicles and characters. */
  worldSeed: 1337,
} as const

export const FIXED_DT = 1 / CONFIG.tickRate
