import type { Move, Piece, Player, Position, Selection } from './types'

/** Comparaisons et filtres d'affichage ; aucune règle de déplacement n'est calculée ici. */
export function samePosition(left: Position, right: Position): boolean {
  return left.row === right.row && left.column === right.column
}

export function positionKey(position: Position): string {
  return `${position.row}:${position.column}`
}

export function coordinateLabel(position: Position): string {
  return `${'ABCDEFGHIJ'[position.column]}${10 - position.row}`
}

function uniquePositions(positions: Position[]): Position[] {
  return [...new Map(positions.map((position) => [positionKey(position), position])).values()]
}

export function selectableOrigins(moves: readonly Move[]): Position[] {
  return uniquePositions(moves.map((move) => move.from))
}

export function matchingMoves(moves: readonly Move[], selection: Selection): Move[] {
  return moves.filter(
    (move) =>
      samePosition(move.from, selection.from) &&
      selection.landings.length <= move.landings.length &&
      selection.landings.every((position, index) => samePosition(position, move.landings[index])),
  )
}

export function nextDestinations(moves: readonly Move[], selection: Selection | null): Position[] {
  if (!selection) return []
  const nextIndex = selection.landings.length
  return uniquePositions(
    matchingMoves(moves, selection)
      .filter((move) => move.landings.length > nextIndex)
      .map((move) => move.landings[nextIndex]),
  )
}

export function completedMove(moves: readonly Move[], selection: Selection): Move | undefined {
  return matchingMoves(moves, selection).find((move) => move.landings.length === selection.landings.length)
}

export function previewPieces(pieces: readonly Piece[], selection: Selection | null): Piece[] {
  const landing = selection?.landings.at(-1)
  return pieces.map((piece) =>
    selection && landing && samePosition(piece, selection.from) ? { ...piece, ...landing } : piece,
  )
}

export function pieceCounts(pieces: readonly Piece[], player: Player): { total: number; kings: number } {
  const owned = pieces.filter((piece) => piece.owner === player)
  return { total: owned.length, kings: owned.filter((piece) => piece.king).length }
}
