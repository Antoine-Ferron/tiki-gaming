export type Grid = number[] // 81 cases, 0 = vide
export type Difficulty = 'easy' | 'medium' | 'hard'

export const DIFFICULTIES: Record<Difficulty, { label: string; clues: number; base: number }> = {
  easy: { label: 'Facile', clues: 40, base: 1000 },
  medium: { label: 'Moyen', clues: 32, base: 2000 },
  hard: { label: 'Difficile', clues: 26, base: 3000 },
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function isValidPlacement(grid: Grid, idx: number, n: number): boolean {
  const r = Math.floor(idx / 9)
  const c = idx % 9
  for (let i = 0; i < 9; i++) {
    if (i !== c && grid[r * 9 + i] === n) return false
    if (i !== r && grid[i * 9 + c] === n) return false
  }
  const br = r - (r % 3)
  const bc = c - (c % 3)
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      const k = (br + i) * 9 + bc + j
      if (k !== idx && grid[k] === n) return false
    }
  }
  return true
}

/** Remplit la grille par backtracking ; `randomize` mélange l'ordre des essais. */
function fill(grid: Grid, randomize: boolean): boolean {
  const idx = grid.indexOf(0)
  if (idx === -1) return true
  const digits = randomize ? shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]) : [1, 2, 3, 4, 5, 6, 7, 8, 9]
  for (const n of digits) {
    if (isValidPlacement(grid, idx, n)) {
      grid[idx] = n
      if (fill(grid, randomize)) return true
      grid[idx] = 0
    }
  }
  return false
}

/** Compte les solutions, s'arrête dès `limit`. */
function countSolutions(grid: Grid, limit: number): number {
  const idx = grid.indexOf(0)
  if (idx === -1) return 1
  let count = 0
  for (let n = 1; n <= 9 && count < limit; n++) {
    if (isValidPlacement(grid, idx, n)) {
      grid[idx] = n
      count += countSolutions(grid, limit - count)
      grid[idx] = 0
    }
  }
  return count
}

export function generatePuzzle(difficulty: Difficulty): { puzzle: Grid; solution: Grid } {
  const solution: Grid = new Array(81).fill(0)
  fill(solution, true)
  const puzzle = [...solution]
  let clues = 81
  for (const idx of shuffle(Array.from({ length: 81 }, (_, i) => i))) {
    if (clues <= DIFFICULTIES[difficulty].clues) break
    const saved = puzzle[idx]
    puzzle[idx] = 0
    if (countSolutions([...puzzle], 2) === 1) clues--
    else puzzle[idx] = saved
  }
  return { puzzle, solution }
}

/** Indices des cases en conflit avec une autre case (même ligne, colonne ou bloc). */
export function findConflicts(grid: Grid): Set<number> {
  const bad = new Set<number>()
  grid.forEach((n, i) => {
    if (n !== 0 && !isValidPlacement(grid, i, n)) bad.add(i)
  })
  return bad
}

/** Plus haut = meilleur : base de difficulté, moins le temps (s) et les erreurs. */
export function computeScore(difficulty: Difficulty, seconds: number, mistakes: number): number {
  return Math.max(10, DIFFICULTIES[difficulty].base - seconds - mistakes * 50)
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
