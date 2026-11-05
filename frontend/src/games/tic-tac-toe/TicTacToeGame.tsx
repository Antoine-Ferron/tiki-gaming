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
      <p className="muted">{ctx.isGuest ? 'Partie locale, sans classement.' : 'Partie locale.'}</p>
      {status === 'IN_PROGRESS' ? (
        <p role="status">Tour du joueur {game.currentPlayer()}</p>
      ) : (
        <p role="status">{statusMessage[status]}</p>
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
      <button type="button" onClick={restart}>
        Rejouer
      </button>
    </div>
  )
}
