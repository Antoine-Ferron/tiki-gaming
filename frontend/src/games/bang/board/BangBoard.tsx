import { useState } from 'react'
import '../bang.css'
import { PlayerMat } from './PlayerMat'
import { canShoot, cardLabel, positionOf, slug, type GameView, type Position } from './view'
import { canUseAs, type Character } from '../cards/characters'

const ICONS = '/games/bang/icons'
const AROUND: Position[] = ['top', 'left', 'right', 'bottom']

/** Le plateau : les quatre tapis autour de la pioche, ma main en bas à droite. */
export function BangBoard({
  view,
  onShoot,
  onDiscard,
  onDraw,
  onEnd,
  onDodge,
  onAccept,
  hidePrivate = false,
}: {
  view: GameView
  /** Appelé avec la carte choisie et la place visée. */
  onShoot?: (cardId: string, targetSeat: number) => void
  /** Appelé avec la carte choisie quand je dois me défausser. */
  onDiscard?: (cardId: string) => void
  /** Appelé quand je pioche en cliquant sur la pioche, au début de mon tour. */
  onDraw?: () => void
  /** Appelé quand je finis mon tour, depuis ma main. */
  onEnd?: () => void
  onDodge?: (cardId: string) => void
  onAccept?: () => void
  hidePrivate?: boolean
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const count = view.hand.length
  const aiming = onShoot !== undefined && canShoot(view)
  const myTurn = !view.pendingShot && view.currentSeat === view.seat
  const drawing = onDraw !== undefined && myTurn && view.phase === 'DRAW'
  const ending = onEnd !== undefined && myTurn && view.phase !== 'DRAW'
  const discarding = onDiscard !== undefined && myTurn && view.phase === 'DISCARD'
  const dodging = onDodge !== undefined && view.pendingShot?.targetSeat === view.seat
  const character = slug<Character>(view.players.find((p) => p.seat === view.seat)?.character ?? '')

  return (
    <div className="bang bang-board">
      {AROUND.map((position) => {
        const player = view.players.find((p) => positionOf(p.seat, view.seat) === position)
        return (
          player && (
            <div key={position} className={`bang-${position}`}>
              <PlayerMat
                player={player}
                view={view}
                hidePrivate={hidePrivate}
                onTarget={
                  aiming && selected && player.seat !== view.seat && player.health > 0
                    ? () => {
                        onShoot(selected, player.seat)
                        setSelected(null)
                      }
                    : undefined
                }
              />
            </div>
          )
        )
      })}
      <div className="bang-center">
        <figure>
          {drawing ? (
            <button type="button" className="bang-pile" aria-label="Piocher" onClick={onDraw}>
              <img className="bang-card" src="/games/bang/cards/back/back.webp" alt="" />
            </button>
          ) : (
            <img className="bang-card" src="/games/bang/cards/back/back.webp" alt="" />
          )}
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
      {!hidePrivate && (
        <section className="bang-hand" aria-label="Ta main">
          <h3>
            Ta main <span>{count === 1 ? '1 carte' : `${count} cartes`}</span>
          </h3>
          <ul>
            {view.hand.map((card) => {
              const label = cardLabel(card.type)
              if (dodging && canUseAs(character, card.type, 'MISSED')) {
                return (
                  <li key={card.id}>
                    <button type="button" onClick={() => onDodge(card.id)}>
                      Esquiver avec {label}
                    </button>
                  </li>
                )
              }
              if (discarding) {
                return (
                  <li key={card.id}>
                    <button type="button" onClick={() => onDiscard(card.id)}>
                      {label}
                    </button>
                  </li>
                )
              }
              if (aiming && canUseAs(character, card.type, 'BANG')) {
                return (
                  <li key={card.id}>
                    <button
                      type="button"
                      aria-pressed={selected === card.id}
                      onClick={() => setSelected(selected === card.id ? null : card.id)}
                    >
                      {label}
                    </button>
                  </li>
                )
              }
              return <li key={card.id}>{label}</li>
            })}
          </ul>
          {ending && (
            <button type="button" onClick={onEnd}>
              Finir le tour
            </button>
          )}
          {onAccept && view.pendingShot?.targetSeat === view.seat && (
            <button type="button" onClick={onAccept}>
              Accepter le tir
            </button>
          )}
        </section>
      )}
    </div>
  )
}
