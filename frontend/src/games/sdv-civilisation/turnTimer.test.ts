import { describe, expect, it } from 'vitest'
import { FakeClock } from './testing/fakes'
import { startTurn, TURN_DURATION_MS, TURN_WARNING_MS } from './turnTimer'

describe('startTurn', () => {
  it('dure 60 secondes, dont 10 de fin de tour', () => {
    expect(TURN_DURATION_MS).toBe(60_000)
    expect(TURN_WARNING_MS).toBe(10_000)
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
    const clock = new FakeClock(1_700_000_000_000)
    const turn = startTurn(clock)

    clock.advance(elapsed)

    expect(turn.phase()).toBe(phase)
  })

  it.each([
    { elapsed: 0, remaining: 60_000 },
    { elapsed: 45_500, remaining: 14_500 },
    { elapsed: 60_000, remaining: 0 },
    { elapsed: 75_000, remaining: 0 },
  ])('après $elapsed ms, il reste $remaining ms', ({ elapsed, remaining }) => {
    const clock = new FakeClock(1_700_000_000_000)
    const turn = startTurn(clock)

    clock.advance(elapsed)

    expect(turn.remainingMs()).toBe(remaining)
  })

  it('compte à partir du début du tour, pas de l’origine de l’horloge', () => {
    const clock = new FakeClock(0)
    clock.advance(55_000)
    const turn = startTurn(clock)

    clock.advance(5_000)

    expect(turn.phase()).toBe('running')
  })

  it('passe d’une phase à l’autre au fil du même tour', () => {
    const clock = new FakeClock()
    const turn = startTurn(clock)
    const phases = [turn.phase()]

    clock.advance(50_000)
    phases.push(turn.phase())
    clock.advance(10_000)
    phases.push(turn.phase())

    expect(phases).toEqual(['running', 'warning', 'expired'])
  })

  it('accepte une durée de tour personnalisée', () => {
    const clock = new FakeClock()
    const turn = startTurn(clock, 20_000)

    clock.advance(20_000)

    expect(turn.phase()).toBe('expired')
  })
})
