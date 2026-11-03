import { duel } from './cardText'
import { BuiltCards, ProductionTokens } from './CityBoard'
import { shields, type PlayerState } from './game'
import { GameIcon } from './GameIcon'

interface Props {
  player: PlayerState
  side: 'left' | 'right'
  /** Boucliers du joueur, pour afficher le duel en cours contre ce voisin. */
  myShields: number
  ready: boolean
}

/**
 * Zone d'un voisin, placée de son côté de la table : sa merveille, son or, son armée, ce qu'on peut lui acheter
 * (en pointillés, avec le prix) et ses bâtiments par couleur.
 */
export function NeighbourPanel({ player, side, myShields, ready }: Props) {
  const label = side === 'left' ? 'Voisin de gauche' : 'Voisin de droite'
  const theirs = shields(player)
  const result = duel(myShields, theirs)
  return (
    <section
      className={`sdv-civilisation-neighbour sdv-civilisation-neighbour-${side}`}
      aria-label={`${label} : ${player.name}`}
    >
      <div className="sdv-civilisation-neighbour-head">
        <span className="sdv-civilisation-avatar" aria-hidden="true">
          IA
        </span>
        <span>
          <span className="sdv-civilisation-muted">{side === 'left' ? `← ${label}` : `${label} →`}</span>
          <strong>{player.name}</strong>
        </span>
        {ready && <span className="sdv-civilisation-ready">✓ a choisi</span>}
      </div>

      <div className="sdv-civilisation-neighbour-wonder">
        <GameIcon k="wonder" size={16} />
        <span>{player.wonder.name}</span>
        <span
          className="sdv-civilisation-pips"
          aria-label={`${player.stagesBuilt} étape(s) bâtie(s) sur ${player.wonder.stages.length}`}
        >
          {player.wonder.stages.map((_, i) => (
            <span key={i} className={i < player.stagesBuilt ? 'sdv-civilisation-pip-built' : undefined} />
          ))}
        </span>
      </div>

      <p className="sdv-civilisation-neighbour-stats">
        <span title="Pièces">
          <GameIcon k="coin" size={17} /> {player.coins}
        </span>
        <span title="Boucliers">
          <GameIcon k="shield" size={17} /> {theirs}
        </span>
        <span className={`sdv-civilisation-duel-${result.kind}`}>
          Duel : {result.label.toLowerCase()} ({myShields} vs {theirs})
        </span>
      </p>

      <div>
        <p className="sdv-civilisation-muted">Achetable chez {player.name} · 2 pièces l’unité</p>
        <ProductionTokens player={player} variant="buy" />
      </div>

      <BuiltCards player={player} label={`Cartes construites de ${player.name}`} />
    </section>
  )
}
