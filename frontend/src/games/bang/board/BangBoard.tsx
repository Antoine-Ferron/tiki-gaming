import '../bang.css'
import { PlayerMat } from './PlayerMat'
import { cardLabel, positionOf, type GameView, type Position } from './view'

const ICONS = '/games/bang/icons'
const AROUND: Position[] = ['top', 'left', 'right', 'bottom']

/** Le plateau : les quatre tapis autour de la pioche, ma main en bas à droite. */
export function BangBoard({ view }: { view: GameView }) {
  const count = view.hand.length

  return (
    <div className="bang bang-board">
      {AROUND.map((position) => {
        const player = view.players.find((p) => positionOf(p.seat, view.seat) === position)
        return (
          player && (
            <div key={position} className={`bang-${position}`}>
              <PlayerMat player={player} view={view} />
            </div>
          )
        )
      })}
      <div className="bang-center">
        <figure>
          <img className="bang-card" src="/games/bang/cards/back/back.webp" alt="" />
          <figcaption>
            <img src={`${ICONS}/pioche.webp`} alt="" />
            Pioche
          </figcaption>
        </figure>
        <figure>
          <div className="bang-card bang-discard" />
          <figcaption>
            <img src={`${ICONS}/defausse.webp`} alt="" />
            Défausse
          </figcaption>
        </figure>
      </div>
      <section className="bang-hand" aria-label="Ta main">
        <h3>
          Ta main <span>{count === 1 ? '1 carte' : `${count} cartes`}</span>
        </h3>
        <ul>
          {view.hand.map((card) => (
            <li key={card.id}>{cardLabel(card.type)}</li>
          ))}
        </ul>
      </section>
    </div>
  )
}
