import type { DameView, Move } from './types'

/** Réponses de serveur réduites : les règles et les 40 pièces initiales sont testées en Java. */
export const MOVE: Move = { from: { row: 6, column: 1 }, landings: [{ row: 5, column: 0 }] }
export const INITIAL: DameView = {
  id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  whiteName: 'Chérif',
  blackName: 'Amadou',
  version: 0,
  board: {
    rows: 10,
    columns: 10,
    pieces: [
      { row: 6, column: 1, owner: 'WHITE', king: false },
      { row: 3, column: 4, owner: 'BLACK', king: true },
    ],
  },
  currentPlayer: 'WHITE',
  status: 'IN_PROGRESS',
  winner: null,
  legalMoves: [MOVE],
  startedAt: '2026-11-05T12:00:00Z',
  finishedAt: null,
}
export const NEXT: DameView = {
  ...INITIAL,
  version: 1,
  board: { ...INITIAL.board, pieces: [{ ...INITIAL.board.pieces[0], row: 5, column: 0 }, INITIAL.board.pieces[1]] },
  currentPlayer: 'BLACK',
  legalMoves: [{ from: { row: 3, column: 4 }, landings: [{ row: 4, column: 3 }] }],
}
