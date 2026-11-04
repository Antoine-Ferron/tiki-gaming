export type Mark = 'X' | 'O'
export type GameStatus = 'IN_PROGRESS' | 'X_WON' | 'O_WON' | 'DRAW'

export class TicTacToeGame {
  private readonly board: (Mark | undefined)[][] = Array.from({ length: 3 }, () =>
    Array<Mark | undefined>(3).fill(undefined),
  )
  private player: Mark = 'X'
  private currentStatus: GameStatus = 'IN_PROGRESS'

  currentPlayer(): Mark {
    return this.player
  }

  status(): GameStatus {
    return this.currentStatus
  }

  cell(row: number, column: number): Mark | undefined {
    this.validateCoordinates(row, column)
    return this.board[row][column]
  }

  place(row: number, column: number): void {
    if (this.currentStatus !== 'IN_PROGRESS') throw new Error('La partie est terminée.')
    this.validateCoordinates(row, column)
    if (this.board[row][column] !== undefined) throw new Error('La case est déjà occupée.')

    this.board[row][column] = this.player
    this.currentStatus = this.determineStatus(this.player)
    if (this.currentStatus === 'IN_PROGRESS') this.player = this.player === 'X' ? 'O' : 'X'
  }

  private determineStatus(mark: Mark): GameStatus {
    if (this.hasWinningLine(mark)) return mark === 'X' ? 'X_WON' : 'O_WON'
    if (this.board.some((row) => row.some((cell) => cell === undefined))) return 'IN_PROGRESS'
    return 'DRAW'
  }

  private hasWinningLine(mark: Mark): boolean {
    return (
      this.board.some((row) => row.every((cell) => cell === mark)) ||
      [0, 1, 2].some((column) => this.board.every((row) => row[column] === mark)) ||
      (this.board[0][0] === mark && this.board[1][1] === mark && this.board[2][2] === mark) ||
      (this.board[0][2] === mark && this.board[1][1] === mark && this.board[2][0] === mark)
    )
  }

  private validateCoordinates(row: number, column: number): void {
    if (row < 0 || row > 2 || column < 0 || column > 2) {
      throw new Error('Les coordonnées doivent être comprises entre 0 et 2.')
    }
  }
}
