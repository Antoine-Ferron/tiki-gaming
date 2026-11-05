import { FILES, piecesFromFen, RANKS, squareLabel, START_FEN, SYMBOLS } from './board'
import './echecs.css'

/**
 * Écran du jeu d'échecs : affiche la position (FEN). Les règles sont dans le moteur côté serveur
 * (backend/.../games/echecs/), appelé par le client ./api.
 */
export default function EchecsGame() {
  const pieces = piecesFromFen(START_FEN)

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
              return (
                <button
                  type="button"
                  key={square}
                  className={`echecs-square ${light ? 'echecs-square-light' : 'echecs-square-dark'}`}
                  aria-label={squareLabel(square, piece)}
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
