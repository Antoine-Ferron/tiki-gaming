import type { CurrencyConverter, Resource } from './ports'
import type { Treasury } from './treasury'

export interface Purchase {
  buyer: string
  seller: string
  resource: Resource
  quantity: number
}

/**
 * Achat de ressources à un voisin, voir docs/games/sdv-civilisation/regles.md#commerce
 * Renvoie le prix payé ; un achat impayable est refusé sans changer aucun trésor.
 */
export function buyFromNeighbour(purchase: Purchase, converter: CurrencyConverter, treasury: Treasury): number {
  const { buyer, seller, resource, quantity } = purchase
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new Error('On achète au moins une ressource')
  }
  if (buyer === seller) {
    throw new Error('On achète à un voisin, pas à soi-même')
  }
  const price = converter.toCoins(resource, quantity)
  treasury.transfer(buyer, seller, price)
  return price
}
