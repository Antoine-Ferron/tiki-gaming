import type { CardColor } from './cards'
import { CATEGORIES, duel } from './cardText'
import { ProductionTokens } from './CityBoard'
import type { PlayerState, TurnEvent } from './game'
import { GameIcon } from './GameIcon'
import type { Resource } from './ports'

const COLOR_ORDER: CardColor[] = ['brown', 'grey', 'blue', 'red', 'green', 'yellow', 'purple']

interface Props {
  player: PlayerState
  side: 'left' | 'right'
  /** Boucliers du joueur, pour afficher le duel en cours contre ce voisin. */
  myShields: number
  ready: boolean
  /** Ressources que le joueur lui achèterait avec la carte choisie. */
  bought: Resource[]
  onOpen: () => void
  /** Pièces gagnées ou perdues au dernier tour, affichées une fois par tour (`stamp`). */
  delta: number
  stamp: string
  /** Pendant la révélation du tour : la carte qu'il vient de jouer, et ce que tu lui paies pour commercer. */
  reveal?: { event: TurnEvent; paid: number }
}

/** Révélation de la carte jouée par une IA : le nom n'est visible que pour un bâtiment (sinon face cachée). */
function Reveal({ name, event, paid }: { name: string; event: TurnEvent; paid: number }) {
  const { card, action } = event
  return (
    <div className="sdv-civilisation-reveal">
      {action === 'build' ? (
        <span className={`sdv-civilisation-reveal-card sdv-civilisation-card-${card.color}`}>
          <GameIcon k={CATEGORIES[card.color].icon} size={18} />
          <span>
            <strong>
              {name} construit {card.name}
            </strong>
            <span>{CATEGORIES[card.color].label}</span>
          </span>
        </span>
      ) : (
        <span className="sdv-civilisation-reveal-card sdv-civilisation-reveal-hidden">
          <GameIcon k={action === 'wonder' ? 'wonder' : 'coin'} size={18} />
          <strong>
            {name} {action === 'wonder' ? 'bâtit une étape de sa merveille' : 'défausse une carte : +3 pièces'}
          </strong>
        </span>
      )}
      {paid > 0 && (
        <span className="sdv-civilisation-reveal-trade">
          <GameIcon k="coin" size={16} /> Tu lui paies {paid} pièces
        </span>
      )}
    </div>
  )
}

/**
 * Zone B : un voisin, en fiche compacte de son côté de la table. L'essentiel est visible (or, boucliers et duel,
 * merveille, ce qu'il te vend, nombre de bâtiments par couleur) ; le détail de sa cité s'ouvre à la demande.
 */
export function NeighbourPanel({ player, side, myShields, ready, bought, onOpen, delta, stamp, reveal }: Props) {
  const label = side === 'left' ? 'Voisin de gauche' : 'Voisin de droite'
  const theirs = player.shields
  const result = duel(myShields, theirs)
  const byColor = COLOR_ORDER.map((color) => ({
    color,
    n: player.built.filter((c) => c.color === color).length,
  })).filter((g) => g.n > 0)

  return (
    <section
      className={`sdv-civilisation-neighbour sdv-civilisation-neighbour-${side}`}
      aria-label={`${label} : ${player.name}`}
    >
      <div className="sdv-civilisation-neighbour-head">
        <span className="sdv-civilisation-avatar" aria-hidden="true">
          IA
        </span>
        <span className="sdv-civilisation-neighbour-name">
          <span className="sdv-civilisation-muted">{side === 'left' ? `← ${label}` : `${label} →`}</span>
          <strong>{player.name}</strong>
        </span>
        {ready && <span className="sdv-civilisation-ready">✓ a choisi</span>}
        <span className="sdv-civilisation-neighbour-numbers">
          <span title="Pièces">
            <GameIcon k="coin" size={22} />
            <span key={player.coins} className="sdv-civilisation-pop">
              {player.coins}
            </span>
            {delta !== 0 && (
              <span
                key={stamp}
                className={`sdv-civilisation-delta ${delta > 0 ? 'sdv-civilisation-gain' : 'sdv-civilisation-loss'}`}
              >
                {delta > 0 ? `+${delta}` : `−${-delta}`}
              </span>
            )}
          </span>
          <span title="Boucliers">
            <GameIcon k="shield" size={22} />
            <span key={theirs} className="sdv-civilisation-pop">
              {theirs}
            </span>
          </span>
        </span>
      </div>

      {reveal && <Reveal name={player.name} {...reveal} />}

      <div className="sdv-civilisation-neighbour-body">
        <div>
          <span className="sdv-civilisation-bar-label">Te vend · 2 pièces l’unité</span>
          <ProductionTokens player={player} variant="buy" highlight={bought} />
        </div>
        <div className="sdv-civilisation-neighbour-side">
          <span className={`sdv-civilisation-duel-${result.kind}`}>
            Duel : {result.label.toLowerCase()} ({myShields} – {theirs})
          </span>
          <span className="sdv-civilisation-muted">
            <GameIcon k="wonder" size={16} /> {player.wonder.name} · {player.stagesBuilt}/{player.wonder.stages.length}
          </span>
        </div>
      </div>

      <div className="sdv-civilisation-neighbour-foot">
        <span className="sdv-civilisation-colors" role="img" aria-label={`${player.built.length} bâtiment(s)`}>
          {byColor.map(({ color, n }) => (
            <span key={color} className={`sdv-civilisation-color-count sdv-civilisation-card-${color}`}>
              <GameIcon k={CATEGORIES[color].icon} size={16} />
              {n}
            </span>
          ))}
          {byColor.length === 0 && <span className="sdv-civilisation-muted">Aucun bâtiment</span>}
        </span>
        <button type="button" className="sdv-civilisation-secondary" onClick={onOpen}>
          Voir la cité de {player.name}
        </button>
      </div>
    </section>
  )
}
