import { describe, expect, it } from 'vitest'
import { quotePurchase } from '../tradeQuote'
import { fixedRate, FakeTreasuryRegistry } from './fakes'

describe('quotePurchase', () => {
  // Stub (taux figé à 5) + fake (registre en mémoire).
  const registry = new FakeTreasuryRegistry({ alice: 10 })

  it('donne le prix du convertisseur et dit si l’acheteur peut payer', () => {
    expect(quotePurchase({ buyer: 'alice', resource: 'wood', quantity: 2 }, fixedRate(5), registry)).toEqual({
      price: 10,
      affordable: true,
    })
    expect(quotePurchase({ buyer: 'alice', resource: 'wood', quantity: 3 }, fixedRate(5), registry).affordable).toBe(
      false,
    )
  })

  it('refuse une quantité nulle', () => {
    expect(() => quotePurchase({ buyer: 'alice', resource: 'wood', quantity: 0 }, fixedRate(5), registry)).toThrow(
      'On achète au moins une ressource',
    )
  })
})
