import { useState } from 'react'
import { GameScreen } from './GameScreen'
import { deal, discard, draw, endTurn, viewOf, type LocalGame } from './local'

/** Partie à quatre sur le même écran, sans compte : l'écran montre la main du joueur dont c'est le tour. */
export function LocalTable() {
  const [game, setGame] = useState<LocalGame>(() => deal())
  const [error, setError] = useState<string | null>(null)

  function run(action: (current: LocalGame) => LocalGame) {
    try {
      setGame(action(game))
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
      <GameScreen
        view={viewOf(game, game.currentSeat)}
        onDraw={() => run(draw)}
        onEnd={() => run(endTurn)}
        onDiscard={(cardId) => run((current) => discard(current, cardId))}
      />
    </div>
  )
}
