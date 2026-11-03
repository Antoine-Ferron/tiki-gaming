import type { CSSProperties } from 'react'
import type { Card } from './cards'
import { costText, effectIcon, effectText, type CardStatus } from './cardText'

interface Props {
  card: Card
  status: CardStatus
  selected: boolean
  offset: number
  onSelect: () => void
}

/** Carte de la main, face visible : effet en grand, coût, et ce que la construction coûterait. */
export function CardFace({ card, status, selected, offset, onSelect }: Props) {
  return (
    <button
      type="button"
      className={`sdv-civilisation-card sdv-civilisation-card-${card.color} sdv-civilisation-status-${status.kind}`}
      style={{ '--sdv-civilisation-offset': offset } as CSSProperties}
      aria-pressed={selected}
      aria-label={`${card.name} : ${effectText(card)}, coût ${costText(card)}. ${status.label}`}
      onClick={onSelect}
    >
      <span className="sdv-civilisation-card-name">{card.name}</span>
      <span className="sdv-civilisation-card-icon" aria-hidden="true">
        {effectIcon(card)}
      </span>
      <span className="sdv-civilisation-card-effect">{effectText(card)}</span>
      <span className="sdv-civilisation-card-cost">Coût : {costText(card)}</span>
      <span className="sdv-civilisation-card-status">{status.label}</span>
    </button>
  )
}

/** Carte posée sur la table devant son joueur : construite (face visible) ou défaussée (face cachée). */
export function PlayedCard({ card, discarded, style }: { card: Card; discarded: boolean; style: CSSProperties }) {
  return (
    <span
      className={`sdv-civilisation-played${discarded ? ' sdv-civilisation-played-back' : ` sdv-civilisation-card-${card.color}`}`}
      style={style}
      aria-hidden="true"
    >
      {discarded ? 'Défaussée' : card.name}
    </span>
  )
}
