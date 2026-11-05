import { useRef, useState } from 'react'
import { GameScreen } from './GameScreen'
import { BangBoard } from './board/BangBoard'
import { deal, discard, draw, endTurn, fire, respond, viewOf, type LocalGame } from './local'

/** Partie à quatre sur le même écran, sans compte : l'écran montre la main du joueur dont c'est le tour. */
export function LocalTable() {
  const [game, setGame] = useState<LocalGame>(() => deal())
  const currentGame = useRef(game)
  const [readySeat, setReadySeat] = useState(game.currentSeat)
  const [error, setError] = useState<string | null>(null)
  const seat = game.pendingShot?.targetSeat ?? game.currentSeat
  const view = viewOf(game, seat)

  function run(action: (current: LocalGame) => LocalGame) {
    try {
      const next = action(currentGame.current)
      currentGame.current = next
      setGame(next)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue.')
    }
  }

  return (
    <div className="bang-game">
      <p className="muted">
        Partie à quatre sur le même écran : l'écran montre la main du joueur dont c'est le tour, passez-vous l'écran à
        chaque tour.
      </p>
      <button type="button" onClick={() => run(() => deal())}>
        Nouvelle partie
      </button>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {readySeat !== seat ? (
        <>
          <p role="status">Passe l'écran à la place {seat}.</p>
          <button type="button" onClick={() => setReadySeat(seat)}>
            Afficher la main de la place {seat}
          </button>
          <BangBoard view={view} hidePrivate />
        </>
      ) : (
        <GameScreen
          view={view}
          onDraw={() => run(draw)}
          onEnd={() => run(endTurn)}
          onDiscard={(cardId) => run((current) => discard(current, cardId))}
          onShoot={(cardId, targetSeat) => run((current) => fire(current, cardId, targetSeat))}
          onDodge={(cardId) => run((current) => respond(current, view.pendingShot!.id, cardId))}
        />
      )}
    </div>
  )
}
