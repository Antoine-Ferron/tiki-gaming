export type Position = { row: number; column: number }
export type Player = 'WHITE' | 'BLACK'
export type Piece = Position & { owner: Player; king: boolean }
export type Move = { from: Position; landings: Position[] }
export type Selection = Move
export type Names = { whiteName: string; blackName: string }

/** État fourni par Java : le navigateur ne calcule ni les coups légaux ni le résultat. */
export type DameView = Names & {
  id: string
  version: number
  board: { rows: number; columns: number; pieces: Piece[] }
  currentPlayer: Player
  status: 'IN_PROGRESS' | 'WHITE_WON' | 'BLACK_WON'
  winner: Player | null
  legalMoves: Move[]
  startedAt: string
  finishedAt: string | null
}
