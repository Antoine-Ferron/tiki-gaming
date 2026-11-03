import { describe, expect, it, vi } from 'vitest'
import { loggerAudit, playersTreasury, standardTrade, systemClock } from '../adapters'
import { createPlayers } from '../setup'

describe('adaptateurs de production', () => {
  it('standardTrade : 2 pièces par ressource', () => {
    expect(standardTrade.toCoins('papyrus', 3)).toBe(6)
  })

  it('playersTreasury : lit et écrit les pièces des joueurs, refuse un inconnu', () => {
    const players = createPlayers(['alice', 'bob', 'carole'])
    const registry = playersTreasury(players)

    registry.setBalance('bob', 7)

    expect(players[1].coins).toBe(7)
    expect(registry.balanceOf('alice')).toBe(3)
    expect(() => registry.balanceOf('dave')).toThrow('Joueur inconnu : dave')
  })

  it('loggerAudit : journalise sans lever d’erreur', () => {
    expect(() => loggerAudit.inactivityDetected({ player: 'alice', deadline: 0 })).not.toThrow()
  })

  it('systemClock : heure du système', () => {
    vi.useFakeTimers({ now: 1_700_000_000_000 })

    expect(systemClock.now()).toBe(1_700_000_000_000)

    vi.useRealTimers()
  })
})
