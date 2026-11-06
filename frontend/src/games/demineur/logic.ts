export type Cell = {
  mine: boolean
  revealed: boolean
  flagged: boolean
  adjacentMines: number
}

export type Grid = Cell[][]

/** Contrat découplé : source d'aléatoire injectable (port), valeur dans [0, 1). */
export interface Rng {
  next(): number
}

/** Adaptateur réel utilisé en production. */
export const realRng: Rng = { next: () => Math.random() }

export function createGrid(rows: number, cols: number, mineCount: number, rng: Rng = realRng): Grid {
  const grid: Grid = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({
      mine: false,
      revealed: false,
      flagged: false,
      adjacentMines: 0,
    })),
  )

  let minesToPlace = mineCount
  while (minesToPlace > 0) {
    const row = Math.floor(rng.next() * rows)
    const col = Math.floor(rng.next() * cols)
    if (!grid[row][col].mine) {
      grid[row][col].mine = true
      minesToPlace--
    }
  }

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      // Stryker disable next-line ConditionalExpression: équivalent, adjacentMines d'une mine
      // n'est jamais lu (revealCell renvoie sur cell.mine avant ; l'UI masque la case tant qu'elle
      // n'est pas révélée, et révélée elle affiche 💣, jamais le chiffre).
      if (!grid[row][col].mine) {
        grid[row][col].adjacentMines = countAdjacentMines(grid, row, col)
      }
    }
  }

  return grid
}

function countAdjacentMines(grid: Grid, row: number, col: number): number {
  let count = 0
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      // Stryker disable next-line ConditionalExpression: équivalent, cette fonction n'est appelée
      // que sur une case sans mine (garde ci-dessus) : (row+0, col+0) == le centre == jamais une mine.
      if (dr === 0 && dc === 0) continue
      // Stryker disable next-line ArithmeticOperator: équivalent, dr et dc parcourent {-1,0,1} de
      // façon symétrique — inverser le signe de l'un des deux visite le même ensemble de voisins.
      if (grid[row + dr]?.[col + dc]?.mine) count++
    }
  }
  return count
}

/** Révèle une case ; cascade sur les voisines si elle n'a aucune mine adjacente. */
export function revealCell(grid: Grid, row: number, col: number): void {
  const cell = grid[row]?.[col]
  if (!cell || cell.revealed || cell.flagged) return

  cell.revealed = true
  if (cell.mine || cell.adjacentMines > 0) return

  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue
      revealCell(grid, row + dr, col + dc)
    }
  }
}

/** Pose ou retire un drapeau sur une case non révélée. */
export function toggleFlag(grid: Grid, row: number, col: number): void {
  const cell = grid[row]?.[col]
  if (!cell || cell.revealed) return
  cell.flagged = !cell.flagged
}

export type Outcome = 'playing' | 'won' | 'lost'

export function getOutcome(grid: Grid): Outcome {
  const cells = grid.flat()
  if (cells.some((cell) => cell.revealed && cell.mine)) return 'lost'
  if (cells.every((cell) => cell.mine || cell.revealed)) return 'won'
  return 'playing'
}

/** Plus rapide et plus de mines = meilleur score. Jamais négatif. */
export function calculateScore(elapsedSeconds: number, mineCount: number): number {
  return Math.max(0, mineCount * 100 - elapsedSeconds)
}
