import { slideLine } from './line'

/** Grille carrée, ligne par ligne ; 0 = case vide. */
export type Grid = readonly (readonly number[])[]

export type Direction = 'left' | 'right' | 'up' | 'down'

export interface MoveResult {
  grid: number[][]
  points: number
  moved: boolean
}

function transpose(grid: Grid): number[][] {
  return grid[0].map((_, column) => grid.map((row) => row[column]))
}

function reverseRows(grid: Grid): number[][] {
  return grid.map((row) => [...row].reverse())
}

/** Ramène chaque direction à un glissement vers la gauche, puis remet la grille dans son sens. */
const orientations: Record<Direction, { to: (grid: Grid) => number[][]; back: (grid: Grid) => number[][] }> = {
  left: { to: (grid) => grid.map((row) => [...row]), back: (grid) => grid.map((row) => [...row]) },
  right: { to: reverseRows, back: reverseRows },
  up: { to: transpose, back: transpose },
  down: { to: (grid) => reverseRows(transpose(grid)), back: (grid) => transpose(reverseRows(grid)) },
}

export function moveGrid(grid: Grid, direction: Direction): MoveResult {
  const { to, back } = orientations[direction]
  let points = 0
  const slid = to(grid).map((row) => {
    const result = slideLine(row)
    points += result.points
    return result.line
  })
  const after = back(slid)
  const moved = after.some((row, r) => row.some((value, c) => value !== grid[r][c]))
  return { grid: after, points, moved }
}

/** Un coup est possible s'il reste une case vide ou deux tuiles égales côte à côte (F3). */
export function canMove(grid: Grid): boolean {
  return grid.some((row, r) =>
    row.some((value, c) => value === 0 || value === row[c + 1] || value === grid[r + 1]?.[c]),
  )
}

export function maxTile(grid: Grid): number {
  return Math.max(...grid.flat())
}
