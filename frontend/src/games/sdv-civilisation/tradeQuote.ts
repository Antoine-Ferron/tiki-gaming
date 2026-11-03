import type { CurrencyConverter, Resource, TreasuryRegistry } from './ports'

export interface PurchaseRequest {
  buyer: string
  resource: Resource
  quantity: number
}

export interface Quote {
  price: number
  affordable: boolean
}

/**
 * Devis affiché avant d'acheter à un voisin, voir docs/games/sdv-civilisation/regles.md#commerce
 * Ne débite rien : c'est le serveur qui valide l'achat et déplace les pièces.
 */
export function quotePurchase(
  request: PurchaseRequest,
  converter: CurrencyConverter,
  registry: TreasuryRegistry,
): Quote {
  const { buyer, resource, quantity } = request
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new Error('On achète au moins une ressource')
  }
  const price = converter.toCoins(resource, quantity)
  return { price, affordable: registry.balanceOf(buyer) >= price }
}
