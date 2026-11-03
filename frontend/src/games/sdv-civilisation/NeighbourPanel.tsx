import type { CardColor } from './cards'
import { CATEGORIES, duel } from './cardText'
import { ProductionTokens } from './CityBoard'
import { shields, type PlayerState } from './game'
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
}

/**
 * Zone B : un voisin, en fiche compacte de son côté de la table. L'essentiel est visible (or, boucliers et duel,
 * merveille, ce qu'il te vend, nombre de bâtiments par couleur) ; le détail de sa cité s'ouvre à la demande.
 */
export function NeighbourPanel({ player, side, myShields, ready, bought, onOpen }: Props) {
  const label = side === 'left' ? 'Voisin de gauche' : 'Voisin de droite'
  const theirs = shields(player)
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
            {player.coins}
          </span>
          <span title="Boucliers">
            <GameIcon k="shield" size={22} />
            {theirs}
          </span>
        </span>
      </div>

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
