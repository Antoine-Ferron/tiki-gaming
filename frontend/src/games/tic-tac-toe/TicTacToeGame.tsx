import { useState } from 'react'
import type { GameProps } from '../types'
import { TicTacToeGame as TicTacToeDomain } from './domain/game'
import './tic-tac-toe.css'

const statusMessage = {
  IN_PROGRESS: null,
  X_WON: 'Le joueur X a gagné !',
  O_WON: 'Le joueur O a gagné !',
  DRAW: 'Match nul !',
} as const

export default function TicTacToeGame({ ctx }: GameProps) {
  const [game, setGame] = useState(() => new TicTacToeDomain())
  const [, refresh] = useState(0)
  const status = game.status()

  function play(row: number, column: number) {
    game.place(row, column)
    refresh((value) => value + 1)
  }

  function restart() {
    setGame(new TicTacToeDomain())
  }

  return (
    <div className="card tic-tac-toe">
      <div className="tic-tac-toe-heading">
        <p className="tic-tac-toe-kicker">Duel local</p>
        <p className="muted">{ctx.isGuest ? 'Partie locale, sans classement.' : 'Partie locale.'}</p>
        {status === 'IN_PROGRESS' ? (
          <p className={`tic-tac-toe-status status-${game.currentPlayer()}`} role="status">
            Tour du joueur <strong>{game.currentPlayer()}</strong>
          </p>
        ) : (
          <p className="tic-tac-toe-status status-finished" role="status">
            {statusMessage[status]}
          </p>
        )}
      </div>
      <div className={`tic-tac-toe-stage${status === 'IN_PROGRESS' ? '' : ' game-finished'}`}>
        {status !== 'IN_PROGRESS' && (
          <>
            <div className="tic-tac-toe-celebration" aria-hidden="true">
              {Array.from({ length: 18 }, (_, index) => (
                <span key={index} />
              ))}
            </div>
            <div className="tic-tac-toe-victory" aria-hidden="true">
              <span>VICTOIRE !</span>
              <small className="tic-tac-toe-winner">
                {status === 'DRAW' ? 'Match nul' : `Joueur ${status[0]} gagne`}
              </small>
            </div>
          </>
        )}
        <div className="tic-tac-toe-board" role="grid" aria-label="Grille de Tic-Tac-Toe">
          {Array.from({ length: 3 }, (_, row) =>
            Array.from({ length: 3 }, (_, column) => {
              const mark = game.cell(row, column)
              return (
                <button
                  key={`${row}-${column}`}
                  type="button"
                  role="gridcell"
                  className={mark ? `mark-${mark}` : undefined}
                  aria-label={`Ligne ${row + 1}, colonne ${column + 1}${mark ? `, ${mark}` : ', vide'}`}
                  disabled={mark !== undefined || status !== 'IN_PROGRESS'}
                  onClick={() => play(row, column)}
                >
                  {mark ?? ''}
                </button>
              )
            }),
          )}
        </div>
      </div>
      <button type="button" onClick={restart}>
        Rejouer
      </button>
    </div>
  )
}
