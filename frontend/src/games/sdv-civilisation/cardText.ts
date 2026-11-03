import type { Card, CardColor, ScienceSymbol } from './cards'
import type { Payment, Refusal } from './game'
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

const ICONS: Record<CardColor, string> = { brown: '⚒', grey: '⚒', blue: '★', red: '⚔', green: '⚗', yellow: '◉' }

/** Symbole de l'effet, affiché en grand sur la carte (décoratif : l'effet est aussi écrit). */
export function effectIcon(card: Card): string {
  return ICONS[card.color]
}

export type CardStatus = { kind: 'free' | 'cost' | 'trade' | 'blocked'; label: string }

// Étiquettes courtes pour tenir sur la carte ; la phrase complète est affichée sous les boutons d'action.
const REFUSALS: Record<Refusal, string> = {
  built: 'Déjà construite',
  resources: 'Ressources manquantes',
  coins: 'Pas assez de pièces',
}

/** Ce que la construction coûterait au joueur, en une étiquette courte. */
export function cardStatus(cost: Payment): CardStatus {
  if (!cost.ok) return { kind: 'blocked', label: REFUSALS[cost.code] }
  const trade = cost.toLeft + cost.toRight
  if (trade > 0) return { kind: 'trade', label: `Achat aux voisins : ${trade} pièces` }
  if (cost.coins > 0) return { kind: 'cost', label: `Se paie en pièces : ${cost.coins}` }
  return { kind: 'free', label: 'Constructible' }
}
