import { describe, expect, it, vi } from 'vitest'
import { fixedRate, FakeTreasuryRegistry } from './testing/fakes'
import { buyFromNeighbour } from './trade'
import { createTreasury } from './treasury'

function setup(balances: Record<string, number>) {
  const registry = new FakeTreasuryRegistry(balances)
  const treasury = createTreasury(registry, { treasuryThresholdCrossed: vi.fn() })
  return { registry, treasury }
}

describe('buyFromNeighbour', () => {
  it('fait payer au vendeur, par l’acheteur, le prix donné par le convertisseur', () => {
    // Taux figé à 5 : le prix vient bien du convertisseur, pas d'un tarif codé en dur.
    const { registry, treasury } = setup({ alice: 12, bob: 0 })

    const price = buyFromNeighbour(
      { buyer: 'alice', seller: 'bob', resource: 'wood', quantity: 2 },
      fixedRate(5),
      treasury,
    )

    expect(price).toBe(10)
    expect(registry.balanceOf('alice')).toBe(2)
    expect(registry.balanceOf('bob')).toBe(10)
  })

  it('demande au convertisseur le prix de la ressource et de la quantité achetées', () => {
    const { treasury } = setup({ alice: 10, bob: 0 })
    const converter = { toCoins: vi.fn(() => 6) }

    buyFromNeighbour({ buyer: 'alice', seller: 'bob', resource: 'glass', quantity: 3 }, converter, treasury)

    expect(converter.toCoins).toHaveBeenCalledExactlyOnceWith('glass', 3)
  })

  it('refuse un achat impayable sans changer aucun trésor', () => {
    const { registry, treasury } = setup({ alice: 3, bob: 0 })

    expect(() =>
      buyFromNeighbour({ buyer: 'alice', seller: 'bob', resource: 'ore', quantity: 2 }, fixedRate(2), treasury),
    ).toThrow('Pas assez de pièces')
    expect(registry.balanceOf('alice')).toBe(3)
    expect(registry.balanceOf('bob')).toBe(0)
  })

  it.each([0, -1, 1.5])('refuse une quantité de %s', (quantity) => {
    const { treasury } = setup({ alice: 10, bob: 0 })

    expect(() =>
      buyFromNeighbour({ buyer: 'alice', seller: 'bob', resource: 'clay', quantity }, fixedRate(2), treasury),
    ).toThrow('On achète au moins une ressource')
  })

  it('refuse d’acheter à soi-même', () => {
    const { treasury } = setup({ alice: 10 })

    expect(() =>
      buyFromNeighbour({ buyer: 'alice', seller: 'alice', resource: 'stone', quantity: 1 }, fixedRate(2), treasury),
    ).toThrow('On achète à un voisin')
  })
})
