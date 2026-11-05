import { useState } from 'react'
import { destinations } from './api'
import { FILES, piecesFromFen, RANKS, squareLabel, START_FEN, SYMBOLS } from './board'
import './echecs.css'

/**
 * Écran du jeu d'échecs : affiche la position (FEN) et interroge le serveur. Les règles sont dans le moteur côté
 * serveur (backend/.../games/echecs/), appelé par le client ./api.
 */
export default function EchecsGame() {
  const [fen] = useState(START_FEN)
  const [selected, setSelected] = useState<string | null>(null)
  const [targets, setTargets] = useState<string[]>([])
  const pieces = piecesFromFen(fen)

  async function select(square: string) {
    setSelected(square)
    setTargets(await destinations(fen, square))
  }

  return (
    <div className="echecs">
      <section className="card">
        <h2>Échecs</h2>
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
                  onClick={() => (piece ? void select(square) : undefined)}
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
