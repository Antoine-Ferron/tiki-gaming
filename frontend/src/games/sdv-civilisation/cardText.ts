import type { Card, CardColor, Cost, ScienceSymbol } from './cards'
import { nextStage, type Payment, type PlayerState, type Refusal } from './game'
import type { Resource } from './ports'
import type { IconKey } from './GameIcon'
import type { WonderStage } from './wonders'

/** Textes affichés au joueur : coûts, effets et statuts, en français. */
export const RESOURCES: Record<Resource, string> = {
  wood: 'bois',
  stone: 'pierre',
  clay: 'argile',
  ore: 'minerai',
  glass: 'verre',
  papyrus: 'papyrus',
  textile: 'textile',
}

const SYMBOLS: Record<ScienceSymbol, string> = { tablet: 'tablette', gear: 'roue', compass: 'compas' }

const COLORS: Record<CardColor, string> = {
  brown: 'marron',
  grey: 'grise',
  blue: 'bleue',
  red: 'rouge',
  green: 'verte',
  yellow: 'jaune',
  purple: 'violette',
}

function resourceList(resources: Resource[]): string {
  const counts = new Map<Resource, number>()
  for (const r of resources) counts.set(r, (counts.get(r) ?? 0) + 1)
  return [...counts].map(([r, n]) => (n > 1 ? `${RESOURCES[r]} ×${n}` : RESOURCES[r])).join(', ')
}

export function costText(cost: Cost): string {
  const parts = []
  if (cost.coins) parts.push(`${cost.coins} pièce`)
  if (cost.resources) parts.push(resourceList(cost.resources))
  return parts.length ? parts.join(' + ') : 'Gratuit'
}

export function effectText(card: Card): string {
  if (card.produces) return `Produit ${resourceList(card.produces)}`
  if (card.points) return `${card.points} points`
  if (card.shields) return `${card.shields} bouclier${card.shields > 1 ? 's' : ''}`
  if (card.science) return `Science : ${SYMBOLS[card.science]}`
  if (card.guild) return `1 point par carte ${card.guild.map((c) => COLORS[c]).join(' ou ')} chez tes voisins`
  return `+${card.coins} pièces`
}

/** Effet d'une étape de merveille. */
export function stageText(stage: WonderStage): string {
  if (stage.points) return `${stage.points} points`
  if (stage.shields) return `${stage.shields} boucliers`
  return `+${stage.coins} pièces`
}

/** Une icône, avec un nombre affiché devant (points, pièces) quand il y en a un. */
export type IconAmount = { k: IconKey; n?: number }

/** Catégorie de carte : se lit deux fois, par la couleur et par ce symbole. */
export const CATEGORIES: Record<CardColor, { label: string; icon: IconKey }> = {
  brown: { label: 'Ressource naturelle', icon: 'mountain' },
  grey: { label: 'Produit manufacturé', icon: 'factory' },
  blue: { label: 'Bâtiment civil', icon: 'column' },
  red: { label: 'Militaire', icon: 'shield' },
  green: { label: 'Science', icon: 'book' },
  yellow: { label: 'Commerce', icon: 'scales' },
  purple: { label: 'Guilde', icon: 'crown' },
}

export const SCIENCE_NAMES = SYMBOLS

const repeat = (k: IconKey, n: number): IconAmount[] => Array.from({ length: n }, () => ({ k }))

/** Ressources d'un coût, une icône par unité (les pièces sont affichées à part). */
export function costIcons(cost: Cost): IconKey[] {
  return cost.resources ?? []
}

/** Effet d'une carte en icônes, affiché en grand au centre de la carte. */
export function effectIcons(card: Card): IconAmount[] {
  if (card.produces) return card.produces.map((k) => ({ k }))
  if (card.points) return [{ k: 'laurel', n: card.points }]
  if (card.shields) return repeat('shield', card.shields)
  if (card.science) return [{ k: card.science }]
  if (card.guild) return [{ k: 'laurel', n: 1 }, ...card.guild.map((c) => ({ k: CATEGORIES[c].icon }))]
  return [{ k: 'coin', n: card.coins }]
}

/** Gain d'une étape de merveille en icônes. */
export function stageIcons(stage: WonderStage): IconAmount[] {
  if (stage.points) return [{ k: 'laurel', n: stage.points }]
  if (stage.shields) return repeat('shield', stage.shields)
  return [{ k: 'coin', n: stage.coins }]
}

/** Duel militaire contre un voisin, avec les boucliers actuels de chacun. */
export function duel(mine: number, theirs: number): { kind: 'win' | 'lose' | 'tie'; label: string } {
  if (mine > theirs) return { kind: 'win', label: 'Victoire' }
  if (mine < theirs) return { kind: 'lose', label: 'Défaite' }
  return { kind: 'tie', label: 'Égalité' }
}

export type CardStatus = { kind: 'free' | 'cost' | 'trade' | 'blocked'; label: string }

// Étiquettes courtes pour tenir sur la carte ; la phrase complète est affichée sur le bouton d'action.
const REFUSALS: Record<Refusal, string> = {
  built: 'Déjà construite',
  resources: 'Ressources manquantes',
  coins: 'Pas assez de pièces',
  wonder: 'Merveille terminée',
}

/** Ce que la construction coûterait au joueur, en une étiquette courte. */
export function cardStatus(cost: Payment): CardStatus {
  if (!cost.ok) return { kind: 'blocked', label: REFUSALS[cost.code] }
  if (cost.chain) return { kind: 'free', label: 'Gratuit par chaîne' }
  const trade = cost.toLeft + cost.toRight
  if (trade > 0) return { kind: 'trade', label: `Achat aux voisins : ${trade} pièces` }
  if (cost.coins > 0) return { kind: 'cost', label: `Se paie en pièces : ${cost.coins}` }
  return { kind: 'free', label: 'Constructible' }
}

/** Détail d'un paiement possible, pour le bouton d'action. */
export function paymentText(cost: Extract<Payment, { ok: true }>, left: string, right: string): string {
  if (cost.chain) return 'Gratuit grâce à la chaîne.'
  if (cost.coins === 0) return 'Gratuit : tu produis déjà ce qu’il faut.'
  const trades = [cost.toLeft > 0 && `${cost.toLeft} à ${left}`, cost.toRight > 0 && `${cost.toRight} à ${right}`]
  const detail = trades.filter(Boolean).join(' et ')
  return `Tu paies ${cost.coins} pièce${cost.coins > 1 ? 's' : ''}${detail ? `, dont ${detail}` : ''}.`
}

/** Explication d'une action : ce qu'elle coûte, ou pourquoi elle est impossible. */
export function actionDetail(cost: Payment, left: string, right: string): string {
  return cost.ok ? paymentText(cost, left, right) : cost.reason
}

/** Titre et explication de l'action « bâtir une étape de merveille ». */
export function wonderAction(player: PlayerState, cost: Payment, left: string, right: string) {
  const stage = nextStage(player)
  if (!stage) return { title: 'Merveille terminée', detail: 'Ta merveille est déjà terminée.' }
  return {
    title: `Bâtir l’étape ${player.stagesBuilt + 1} de ta merveille`,
    detail: `${costText(stage.cost)} → ${stageText(stage)}. ${actionDetail(cost, left, right)}`,
  }
}
