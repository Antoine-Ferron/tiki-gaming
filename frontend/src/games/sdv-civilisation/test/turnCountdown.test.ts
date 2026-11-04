import { describe, expect, it } from 'vitest'
import { formatRemaining, turnPhase, WARNING_MS } from '../turnCountdown'

describe('Minuteur du tour (affichage)', () => {
  it('passe en alerte dans les 10 dernières secondes, puis expire à zéro', () => {
    expect([turnPhase(WARNING_MS + 1), turnPhase(WARNING_MS), turnPhase(1), turnPhase(0)]).toEqual([
      'running',
      'warning',
      'warning',
      'expired',
    ])
  })

  it('affiche les minutes et secondes restantes, arrondies à la seconde supérieure', () => {
    expect([formatRemaining(60_000), formatRemaining(9_001), formatRemaining(0), formatRemaining(-5)]).toEqual([
      '1:00',
      '0:10',
      '0:00',
      '0:00',
    ])
  })
})
