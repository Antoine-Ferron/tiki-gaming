import { useState } from 'react'
import { ApiError } from '@/lib/api'
import { destinations, play } from './api'
import { FILES, piecesFromFen, RANKS, squareLabel, START_FEN, SYMBOLS } from './board'
import './echecs.css'

/**
 * Écran du jeu d'échecs : affiche la position (FEN) et interroge le serveur. Les règles sont dans le moteur côté
 * serveur (backend/.../games/echecs/), appelé par le client ./api.
 */
export default function EchecsGame() {
  const [fen, setFen] = useState(START_FEN)
  const [selected, setSelected] = useState<string | null>(null)
  const [targets, setTargets] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const pieces = piecesFromFen(fen)

  /** Appelle le serveur ; en cas de refus (422) ou de panne, affiche le message prévu pour le joueur. */
  async function call(action: () => Promise<void>) {
    setError(null)
    try {
      await action()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur inattendue est survenue. Réessaie.')
    }
  }

  function select(square: string) {
    setSelected(square)
    void call(async () => setTargets(await destinations(fen, square)))
  }

  function moveTo(square: string) {
    const from = selected as string
    setSelected(null)
    setTargets([])
    void call(async () => setFen(await play(fen, from, square)))
  }

  function handleClick(square: string) {
    if (selected && targets.includes(square)) moveTo(square)
    else if (pieces[square]) select(square)
  }

  return (
    <div className="echecs">
      <section className="card">
        <h2>Échecs</h2>
        {error && (
          <p className="echecs-error" role="alert">
            {error}
          </p>
        )}
        <div className="echecs-board" role="group" aria-label="Échiquier">
          {RANKS.map((rank) =>
            FILES.map((file, fileIndex) => {
              const square = `${file}${rank}`
              const piece = pieces[square]
              const light = (fileIndex + rank) % 2 === 0 // h1 est une case claire
              const classes = [
                'echecs-square',
                light ? 'echecs-square-light' : 'echecs-square-dark',
                targets.includes(square) ? 'echecs-square-target' : '',
              ]
              return (
                <button
                  type="button"
                  key={square}
                  className={classes.join(' ').trim()}
                  aria-label={squareLabel(square, piece)}
                  aria-pressed={selected === square}
                  onClick={() => handleClick(square)}
                >
                  {piece ? SYMBOLS[piece] : ''}
                </button>
              )
            }),
          )}
        </div>
      </section>
    </div>
  )
}
