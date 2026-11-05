import type { Card } from './cards'
import { actionDetail, CATEGORIES, effectText, RESOURCES, wonderAction } from './cardText'
import type { Payment, PlayerState, ResourceNeed } from './game'
import { GameIcon } from './GameIcon'

/** Chaque ressource d'un coût : produite par toi (vert), achetée à un voisin (doré), ou manquante (rouge). */
function Needs({ needs, left, right }: { needs: ResourceNeed[]; left: string; right: string }) {
  return (
    <span className="sdv-civilisation-needs">
      {needs.flatMap((need) => {
        const name = RESOURCES[need.resource]
        const rows = [
          need.own > 0 && { kind: 'own', text: `${need.own} ${name} : tu le produis` },
          need.fromLeft > 0 && { kind: 'buy', text: `${need.fromLeft} ${name} acheté à ${left}` },
          need.fromRight > 0 && { kind: 'buy', text: `${need.fromRight} ${name} acheté à ${right}` },
          need.missing > 0 && { kind: 'missing', text: `${need.missing} ${name} manquant` },
        ].filter((row): row is { kind: string; text: string } => Boolean(row))
        return rows.map((row) => (
          <span
            key={`${need.resource}-${row.text}`}
            className={`sdv-civilisation-need sdv-civilisation-need-${row.kind}`}
          >
            <GameIcon k={need.resource} size={20} />
            {row.text}
          </span>
        ))
      })}
    </span>
  )
}

interface Props {
  card: Card
  player: PlayerState
  left: string
  right: string
  build: { cost: Payment; needs: ResourceNeed[] }
  wonder: { cost: Payment; needs: ResourceNeed[] }
  onPlay: (type: 'build' | 'wonder' | 'discard') => void
}

/** Panneau de la carte choisie : ce qu'elle fait, et les trois actions possibles avec leur coût exact. */
export function CardDetail({ card, player, left, right, build, wonder, onPlay }: Props) {
  const stage = wonderAction(player, wonder.cost, left, right)
  return (
    <section className="sdv-civilisation-detail" aria-label={`Que faire de ${card.name}`}>
      <div className={`sdv-civilisation-detail-head sdv-civilisation-card-${card.color}`}>
        <GameIcon k={CATEGORIES[card.color].icon} size={20} />
        <span>
          <strong>{card.name}</strong>
          <span>
            {CATEGORIES[card.color].label} · {effectText(card)}
          </span>
        </span>
      </div>

      <button
        type="button"
        className="sdv-civilisation-action sdv-civilisation-action-build"
        disabled={!build.cost.ok}
        onClick={() => onPlay('build')}
      >
        <span className="sdv-civilisation-action-title">Construire {card.name}</span>
        <Needs needs={build.needs} left={left} right={right} />
        <span className="sdv-civilisation-action-detail">{actionDetail(build.cost, left, right)}</span>
      </button>

      <button
        type="button"
        className="sdv-civilisation-action sdv-civilisation-action-wonder"
        disabled={!wonder.cost.ok}
        onClick={() => onPlay('wonder')}
      >
        <span className="sdv-civilisation-action-title">{stage.title}</span>
        <Needs needs={wonder.needs} left={left} right={right} />
        <span className="sdv-civilisation-action-detail">{stage.detail}</span>
      </button>

      <button
        type="button"
        className="sdv-civilisation-action sdv-civilisation-action-discard"
        onClick={() => onPlay('discard')}
      >
        <span className="sdv-civilisation-action-title">Défausser</span>
        <span className="sdv-civilisation-action-detail">
          +3 pièces → {player.coins + 3} pièces ; la carte va sur la défausse.
        </span>
      </button>
    </section>
  )
}
