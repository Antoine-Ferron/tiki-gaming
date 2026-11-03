import type { Card, ScienceSymbol } from './cards'
import type { Resource } from './ports'

/** Textes affichés sur une carte : coût et effet, en français. */
const RESOURCES: Record<Resource, string> = {
  wood: 'bois',
  stone: 'pierre',
  clay: 'argile',
  ore: 'minerai',
  glass: 'verre',
  papyrus: 'papyrus',
  textile: 'textile',
}

const SYMBOLS: Record<ScienceSymbol, string> = { tablet: 'tablette', gear: 'roue', compass: 'compas' }

function resourceList(resources: Resource[]): string {
  const counts = new Map<Resource, number>()
  for (const r of resources) counts.set(r, (counts.get(r) ?? 0) + 1)
  return [...counts].map(([r, n]) => (n > 1 ? `${RESOURCES[r]} ×${n}` : RESOURCES[r])).join(', ')
}

export function costText(card: Card): string {
  const parts = []
  if (card.cost.coins) parts.push(`${card.cost.coins} pièce`)
  if (card.cost.resources) parts.push(resourceList(card.cost.resources))
  return parts.length ? parts.join(' + ') : 'Gratuit'
}

export function effectText(card: Card): string {
  if (card.produces) return `Produit ${resourceList(card.produces)}`
  if (card.points) return `${card.points} points`
  if (card.shields) return `${card.shields} bouclier${card.shields > 1 ? 's' : ''}`
  if (card.science) return `Science : ${SYMBOLS[card.science]}`
  return `+${card.coins} pièces`
}
