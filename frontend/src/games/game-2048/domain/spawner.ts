import type { Grid } from './board'

/** Pose une nouvelle tuile sur la grille ; injecté dans la partie pour pouvoir le remplacer en test. */
export interface TileSpawner {
  spawn(grid: Grid): number[][]
}

/** Un nombre dans [0, 1[, comme Math.random. */
export type Random = () => number

/** Nouvelle tuile sur une case vide au hasard : un 2 dans 90 % des cas, un 4 sinon (R6). */
export function randomSpawner(random: Random = Math.random): TileSpawner {
  return {
    spawn(grid) {
      const next = grid.map((row) => [...row])
      const empty = next.flatMap((row, r) => row.flatMap((value, c) => (value === 0 ? [[r, c]] : [])))
      if (empty.length === 0) return next

      const [row, column] = empty[Math.floor(random() * empty.length)]
      next[row][column] = random() < 0.9 ? 2 : 4
      return next
    },
  }
}
