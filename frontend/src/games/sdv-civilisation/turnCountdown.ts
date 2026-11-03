import type { AuditNotifier, Clock } from './ports'

export const WARNING_MS = 10_000

export type TurnPhase = 'running' | 'warning' | 'expired'

export interface Countdown {
  remainingMs(): number
  /** Phase à afficher ; signale une seule fois au journal d'audit le joueur qui laisse expirer son tour. */
  tick(): TurnPhase
  /** Le joueur a choisi sa carte : plus de signalement d'inactivité pour ce tour. */
  played(): void
}

/**
 * Compte à rebours d'un tour, voir docs/games/sdv-civilisation/regles.md#temps-de-tour
 * L'heure limite vient du serveur, qui fait autorité ; le front ne fait que l'afficher.
 */
export function createCountdown(
  turn: { player: string; deadline: number },
  clock: Clock,
  audit: AuditNotifier,
): Countdown {
  let done = false
  const remainingMs = () => Math.max(0, turn.deadline - clock.now())

  return {
    remainingMs,
    tick() {
      const remaining = remainingMs()
      if (remaining > WARNING_MS) return 'running'
      if (remaining > 0) return 'warning'
      if (!done) {
        done = true
        audit.inactivityDetected({ player: turn.player, deadline: turn.deadline })
      }
      return 'expired'
    },
    played() {
      done = true
    },
  }
}
