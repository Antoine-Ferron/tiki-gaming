import { describe, expect, it, vi } from 'vitest'
import type { AuditNotifier } from '../ports'
import { createCountdown } from '../turnCountdown'
import { FakeClock } from './fakes'

const DEADLINE = 60_000

// Fake (horloge avancée à la main, sans attente réelle) + mock (passerelle d'audit).
function setup() {
  const clock = new FakeClock(0)
  const audit = { inactivityDetected: vi.fn<AuditNotifier['inactivityDetected']>() }
  return { clock, audit, countdown: createCountdown({ player: 'alice', deadline: DEADLINE }, clock, audit) }
}

describe('createCountdown', () => {
  it('passe de running à warning puis expired', () => {
    const { clock, countdown } = setup()

    expect(countdown.tick()).toBe('running')
    clock.advance(50_000)
    expect(countdown.tick()).toBe('warning')
    expect(countdown.remainingMs()).toBe(10_000)
    clock.advance(10_000)
    expect(countdown.tick()).toBe('expired')
  })

  it('signale une seule fois le joueur qui laisse expirer son tour', () => {
    const { clock, audit, countdown } = setup()

    clock.advance(DEADLINE)
    countdown.tick()
    countdown.tick()

    expect(audit.inactivityDetected).toHaveBeenCalledExactlyOnceWith({ player: 'alice', deadline: DEADLINE })
  })

  it('ne signale pas le joueur qui a joué', () => {
    const { clock, audit, countdown } = setup()

    countdown.played()
    clock.advance(DEADLINE)
    countdown.tick()

    expect(audit.inactivityDetected).not.toHaveBeenCalled()
  })
})
