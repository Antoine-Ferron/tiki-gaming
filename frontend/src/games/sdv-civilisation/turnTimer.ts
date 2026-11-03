import type { Clock } from './ports'

export const TURN_DURATION_MS = 60_000
export const TURN_WARNING_MS = 10_000

export type TurnPhase = 'running' | 'warning' | 'expired'

export interface TurnTimer {
  remainingMs(): number
  phase(): TurnPhase
}

/** Minuteur d'un tour, voir docs/games/sdv-civilisation/regles.md#temps-de-tour */
export function startTurn(clock: Clock, duration = TURN_DURATION_MS): TurnTimer {
  const deadline = clock.now() + duration
  const remainingMs = () => Math.max(0, deadline - clock.now())

  return {
    remainingMs,
    phase() {
      const remaining = remainingMs()
      if (remaining === 0) return 'expired'
      if (remaining <= TURN_WARNING_MS) return 'warning'
      return 'running'
    },
  }
}
