import type { CSSProperties } from 'react'
import type { Card } from './cards'
import { CATEGORIES, costIcons, costText, effectIcons, effectText, type CardStatus } from './cardText'
import { CostIcons, GameIcon, IconRow } from './GameIcon'

const AGES = ['I', 'II', 'III']

interface Props {
  card: Card
  status: CardStatus
  selected: boolean
  onSelect: () => void
  /** Animation en cours (arrivée, envol vers la cité…) et ses variables CSS. */
  motion?: string
  style?: CSSProperties
  disabled?: boolean
}

/**
 * Carte de la main, verticale (5:7) : bandeau de catégorie (couleur + symbole), effet en grand au centre, chaîne,
 * coût sur fond sombre, puis ce que la construction coûterait au joueur.
 */
export function CardFace({ card, status, selected, onSelect, motion, style, disabled }: Props) {
  const category = CATEGORIES[card.color]
  const chain = card.chainFrom ? ` Gratuite si tu as ${card.chainFrom}.` : ''
  return (
    <button
      type="button"
      className={`sdv-civilisation-card sdv-civilisation-card-${card.color} sdv-civilisation-status-${status.kind}${motion ? ` ${motion}` : ''}`}
      style={style}
      disabled={disabled}
      aria-pressed={selected}
      aria-label={`${card.name} (${category.label}) : ${effectText(card)}, coût ${costText(card.cost)}.${chain} ${status.label}`}
      onClick={onSelect}
    >
      <span className="sdv-civilisation-card-band">
        <GameIcon k={category.icon} size={14} />
        <span className="sdv-civilisation-card-name">{card.name}</span>
        <span className="sdv-civilisation-card-age">{AGES[card.age - 1]}</span>
      </span>
      <span className="sdv-civilisation-card-body">
        <IconRow items={effectIcons(card)} size={26} />
        <span className="sdv-civilisation-card-effect">{effectText(card)}</span>
      </span>
      {card.chainFrom && (
        <span className="sdv-civilisation-card-chain" aria-hidden="true">
          <GameIcon k="chain" size={12} /> si {card.chainFrom}
        </span>
      )}
      <span className="sdv-civilisation-card-cost" aria-hidden="true">
        <span>Coût</span>
        <CostIcons resources={costIcons(card.cost)} coins={card.cost.coins} size={15} />
      </span>
      <span className="sdv-civilisation-card-status">{status.label}</span>
    </button>
  )
}
