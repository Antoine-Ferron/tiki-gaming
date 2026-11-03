import type { CSSProperties } from 'react'
import type { Card } from './cards'
import { costText, effectText } from './cardText'

interface Props {
  card: Card
  selected: boolean
  offset: number
  onSelect: () => void
}

/** Carte de la main, face visible : couleur, nom, coût et effet. */
export function CardFace({ card, selected, offset, onSelect }: Props) {
  return (
    <button
      type="button"
      className={`sdv-civilisation-card sdv-civilisation-card-${card.color}`}
      style={{ '--sdv-civilisation-offset': offset } as CSSProperties}
      aria-pressed={selected}
      aria-label={`${card.name} : ${effectText(card)}, coût ${costText(card)}`}
      onClick={onSelect}
    >
      <span className="sdv-civilisation-card-name">{card.name}</span>
      <span className="sdv-civilisation-card-effect">{effectText(card)}</span>
      <span className="sdv-civilisation-card-cost">{costText(card)}</span>
    </button>
  )
}
