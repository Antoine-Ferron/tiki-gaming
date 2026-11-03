import type { Board, Move } from './board'
import { isSolved, moveRange, moveVehicle } from './moves'

type Path = { board: Board; moves: Move[] }

/**
 * Solution la plus courte (parcours en largeur : on essaie tous les plateaux à 1 coup, puis à 2 coups…),
 * ou null si le plateau est impossible. Un coup = un glissement, quelle que soit la distance.
 */
export function solve(start: Board): Move[] | null {
  if (isSolved(start)) return []

  const seen = new Set([keyOf(start)])
  let frontier: Path[] = [{ board: start, moves: [] }]

  while (frontier.length > 0) {
    const next: Path[] = []
    for (const path of frontier) {
      for (const move of possibleMoves(path.board)) {
        const board = moveVehicle(path.board, move.id, move.delta)
        const key = keyOf(board)
        if (seen.has(key)) continue
        seen.add(key)
        const moves = [...path.moves, move]
        if (isSolved(board)) return moves
        next.push({ board, moves })
      }
    }
    frontier = next
  }
  return null
}

/** Tous les glissements possibles depuis un plateau (chaque véhicule, chaque sens, chaque distance). */
export function possibleMoves(board: Board): Move[] {
  return board.vehicles.flatMap((v) => {
    const { min, max } = moveRange(board, v.id)
    const deltas = [...range(min, -1), ...range(1, max)]
    return deltas.map((delta) => ({ id: v.id, delta }))
  })
}

function range(from: number, to: number): number[] {
  return from > to ? [] : Array.from({ length: to - from + 1 }, (_, i) => from + i)
}

function keyOf(board: Board): string {
  return board.vehicles.map((v) => `${v.id}${v.row}${v.col}`).join('')
}
