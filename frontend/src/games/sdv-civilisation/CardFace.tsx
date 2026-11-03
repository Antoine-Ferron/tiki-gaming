import type { CSSProperties } from 'react'
import type { Card } from './cards'
import { costText, effectIcon, effectText, type CardStatus } from './cardText'
import type { Action } from './game'

interface Props {
  card: Card
  status: CardStatus
  selected: boolean
  offset: number
  onSelect: () => void
}

/** Carte de la main, face visible : effet en grand, coût, chaîne, et ce que la construction coûterait. */
export function CardFace({ card, status, selected, offset, onSelect }: Props) {
  const chain = card.chainFrom ? ` Gratuite si tu as ${card.chainFrom}.` : ''
  return (
    <button
      type="button"
      className={`sdv-civilisation-card sdv-civilisation-card-${card.color} sdv-civilisation-status-${status.kind}`}
      style={{ '--sdv-civilisation-offset': offset } as CSSProperties}
      aria-pressed={selected}
      aria-label={`${card.name} : ${effectText(card)}, coût ${costText(card.cost)}.${chain} ${status.label}`}
      onClick={onSelect}
    >
      <span className="sdv-civilisation-card-name">{card.name}</span>
      <span className="sdv-civilisation-card-icon" aria-hidden="true">
        {effectIcon(card)}
      </span>
      <span className="sdv-civilisation-card-effect">{effectText(card)}</span>
      <span className="sdv-civilisation-card-cost">Coût : {costText(card.cost)}</span>
      {card.chainFrom && <span className="sdv-civilisation-card-chain">⛓ si {card.chainFrom}</span>}
      <span className="sdv-civilisation-card-status">{status.label}</span>
    </button>
  )
}

const HIDDEN: Record<Exclude<Action['type'], 'build'>, string> = { wonder: 'Merveille', discard: 'Défaussée' }

/** Carte posée sur la table devant son joueur : construite (face visible), ou face cachée (merveille, défausse). */
export function PlayedCard({ card, action, style }: { card: Card; action: Action['type']; style: CSSProperties }) {
  const built = action === 'build'
  return (
    <span
      className={`sdv-civilisation-played${built ? ` sdv-civilisation-card-${card.color}` : ' sdv-civilisation-played-back'}`}
      style={style}
      aria-hidden="true"
    >
      {built ? card.name : HIDDEN[action]}
    </span>
  )
}
