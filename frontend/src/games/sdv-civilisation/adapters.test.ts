import { afterEach, describe, expect, it, vi } from 'vitest'
import { playersTreasury, standardTrade, systemClock, TRADE_PRICE } from './adapters'
import { createPlayers } from './setup'

describe('standardTrade', () => {
  it('fixe le prix standard à 2 pièces par ressource', () => {
    expect(TRADE_PRICE).toBe(2)
  })

  it.each([
    { quantity: 1, expected: 2 },
    { quantity: 3, expected: 6 },
  ])('$quantity ressource(s) coûtent $expected pièces', ({ quantity, expected }) => {
    expect(standardTrade.toCoins('papyrus', quantity)).toBe(expected)
  })
})

describe('playersTreasury', () => {
  it('lit et écrit les pièces des joueurs de la partie', () => {
    const players = createPlayers(['alice', 'bob', 'carole'])
    const registry = playersTreasury(players)

    registry.setBalance('bob', 7)

    expect(registry.balanceOf('alice')).toBe(1)
    expect(registry.balanceOf('bob')).toBe(7)
    expect(players[1].coins).toBe(7)
  })

  it('refuse un joueur absent de la partie', () => {
    const registry = playersTreasury(createPlayers(['alice', 'bob', 'carole']))

    expect(() => registry.balanceOf('dave')).toThrow('Joueur inconnu : dave')
  })
})

describe('systemClock', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('donne l’heure du système', () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_700_000_000_000)

    expect(systemClock.now()).toBe(1_700_000_000_000)
  })
})
