import { describe, expect, it, vi } from 'vitest'
import { quotePurchase } from '../tradeQuote'
import { fixedRate, FakeTreasuryRegistry } from './fakes'

describe('quotePurchase', () => {
  it('affiche le prix donné par le convertisseur', () => {
    // Taux figé à 5 : le prix vient bien du convertisseur, pas d'un tarif codé en dur.
    const registry = new FakeTreasuryRegistry({ alice: 12 })

    const quote = quotePurchase({ buyer: 'alice', resource: 'wood', quantity: 2 }, fixedRate(5), registry)

    expect(quote.price).toBe(10)
  })

  it('demande au convertisseur le prix de la ressource et de la quantité', () => {
    const converter = { toCoins: vi.fn(() => 6) }

    quotePurchase({ buyer: 'alice', resource: 'glass', quantity: 3 }, converter, new FakeTreasuryRegistry())

    expect(converter.toCoins).toHaveBeenCalledExactlyOnceWith('glass', 3)
  })

  // Frontière : le joueur peut payer s'il a exactement le prix.
  it.each([
    { coins: 3, affordable: false },
    { coins: 4, affordable: true },
    { coins: 9, affordable: true },
  ])('avec $coins pièces pour un prix de 4, achat possible = $affordable', ({ coins, affordable }) => {
    const registry = new FakeTreasuryRegistry({ alice: coins })

    const quote = quotePurchase({ buyer: 'alice', resource: 'ore', quantity: 2 }, fixedRate(2), registry)

    expect(quote.affordable).toBe(affordable)
  })

  it('ne débite rien : le serveur fait autorité', () => {
    const registry = new FakeTreasuryRegistry({ alice: 10 })

    quotePurchase({ buyer: 'alice', resource: 'clay', quantity: 2 }, fixedRate(2), registry)

    expect(registry.balanceOf('alice')).toBe(10)
  })

  it.each([0, -1, 1.5])('refuse une quantité de %s', (quantity) => {
    expect(() =>
      quotePurchase({ buyer: 'alice', resource: 'clay', quantity }, fixedRate(2), new FakeTreasuryRegistry()),
    ).toThrow('On achète au moins une ressource')
  })
})
