import { describe, expect, it, vi } from 'vitest'
import type { AuditNotifier } from '../ports'
import { createCountdown, WARNING_MS } from '../turnCountdown'
import { FakeClock } from './fakes'

const NOW = 1_700_000_000_000
// Heure limite envoyée par le serveur : 60 s après le début du tour.
const DEADLINE = NOW + 60_000

/** Mock : enregistre les appels à la passerelle d'audit, sans journal réel. */
function setup() {
  const clock = new FakeClock(NOW)
  const audit = { inactivityDetected: vi.fn<AuditNotifier['inactivityDetected']>() }
  const countdown = createCountdown({ player: 'alice', deadline: DEADLINE }, clock, audit)
  return { clock, audit, countdown }
}

describe('createCountdown', () => {
  it('signale les 10 dernières secondes', () => {
    expect(WARNING_MS).toBe(10_000)
  })

  // Une ligne par frontière : aucune attente réelle, l'horloge avance à la main.
  it.each([
    { elapsed: 0, phase: 'running' },
    { elapsed: 49_999, phase: 'running' },
    { elapsed: 50_000, phase: 'warning' },
    { elapsed: 59_999, phase: 'warning' },
    { elapsed: 60_000, phase: 'expired' },
    { elapsed: 90_000, phase: 'expired' },
  ])('après $elapsed ms, le tour est $phase', ({ elapsed, phase }) => {
    const { clock, countdown } = setup()

    clock.advance(elapsed)

    expect(countdown.tick()).toBe(phase)
  })

  it.each([
    { elapsed: 0, remaining: 60_000 },
    { elapsed: 45_500, remaining: 14_500 },
    { elapsed: 75_000, remaining: 0 },
  ])('après $elapsed ms, affiche $remaining ms restantes', ({ elapsed, remaining }) => {
    const { clock, countdown } = setup()

    clock.advance(elapsed)

    expect(countdown.remainingMs()).toBe(remaining)
  })

  it('ne signale rien tant que le tour n’a pas expiré', () => {
    const { clock, audit, countdown } = setup()

    clock.advance(59_999)
    countdown.tick()

    expect(audit.inactivityDetected).not.toHaveBeenCalled()
  })

  it('signale une seule fois le joueur qui laisse expirer son tour', () => {
    const { clock, audit, countdown } = setup()

    clock.advance(60_000)
    countdown.tick()
    clock.advance(1_000)
    countdown.tick()

    expect(audit.inactivityDetected).toHaveBeenCalledExactlyOnceWith({ player: 'alice', deadline: DEADLINE })
  })

  it('ne signale pas le joueur qui a joué avant l’expiration', () => {
    const { clock, audit, countdown } = setup()

    clock.advance(30_000)
    countdown.played()
    clock.advance(30_000)
    countdown.tick()

    expect(audit.inactivityDetected).not.toHaveBeenCalled()
  })
})
