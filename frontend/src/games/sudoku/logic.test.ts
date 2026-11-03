import { afterEach, describe, expect, test, vi } from 'vitest'
import {
  DIFFICULTIES,
  computeScore,
  findConflicts,
  formatTime,
  generatePuzzle,
  isValidPlacement,
  type Difficulty,
  type Grid,
} from './logic'

const emptyGrid = (): Grid => new Array(81).fill(0)

/** Générateur pseudo-aléatoire à graine : les grilles générées sont reproductibles. */
const seededRandom = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296
  return seed / 4294967296
}

afterEach(() => vi.restoreAllMocks())

describe('isValidPlacement', () => {
  const grid = emptyGrid()
  grid[0] = 5

  test.each([
    ['la ligne', 8],
    ['la colonne', 72],
    ['le bloc', 10],
  ])('refuse un doublon dans %s', (_zone, index) => {
    // Act / Assert
    expect(isValidPlacement(grid, index, 5)).toBe(false)
  })

  test('accepte un chiffre sans doublon', () => {
    expect(isValidPlacement(grid, 40, 5)).toBe(true)
    expect(isValidPlacement(grid, 8, 6)).toBe(true)
  })

  test('ignore la case elle-même', () => {
    expect(isValidPlacement(grid, 0, 5)).toBe(true)
  })
})

describe('findConflicts', () => {
  test('signale les deux cases d’un doublon', () => {
    // Arrange
    const grid = emptyGrid()
    grid[0] = 3
    grid[4] = 3

    // Act
    const conflicts = findConflicts(grid)

    // Assert
    expect([...conflicts].sort()).toEqual([0, 4])
  })

  test('ne signale rien dans une grille sans doublon', () => {
    expect(findConflicts(emptyGrid()).size).toBe(0)
  })
})

describe('generatePuzzle', () => {
  test.each<Difficulty>(['easy', 'medium', 'hard'])('génère une grille %s cohérente avec sa solution', (level) => {
    // Arrange
    vi.spyOn(Math, 'random').mockImplementation(seededRandom(42))

    // Act
    const { puzzle, solution } = generatePuzzle(level)

    // Assert
    expect(solution).not.toContain(0)
    expect(findConflicts(solution).size).toBe(0)
    puzzle.forEach((n, i) => {
      if (n !== 0) expect(n).toBe(solution[i])
    })
    // La cible est atteinte, ou dépassée d'un indice quand plus aucune case ne peut être retirée.
    const clues = puzzle.filter((n) => n !== 0).length
    expect(clues).toBeGreaterThanOrEqual(DIFFICULTIES[level].clues)
    expect(clues).toBeLessThanOrEqual(DIFFICULTIES[level].clues + 1)
  })

  test('est reproductible avec la même graine', () => {
    // Arrange
    const spy = vi.spyOn(Math, 'random')

    // Act
    spy.mockImplementation(seededRandom(7))
    const first = generatePuzzle('easy').puzzle
    spy.mockImplementation(seededRandom(7))
    const second = generatePuzzle('easy').puzzle

    // Assert
    expect(second).toEqual(first)
  })

  test('laisse moins d’indices aux niveaux plus difficiles', () => {
    expect(DIFFICULTIES.easy.clues).toBeGreaterThan(DIFFICULTIES.medium.clues)
    expect(DIFFICULTIES.medium.clues).toBeGreaterThan(DIFFICULTIES.hard.clues)
  })
})

describe('computeScore', () => {
  test('retire le temps et 50 points par erreur à la base de la difficulté', () => {
    expect(computeScore('easy', 100, 2)).toBe(1000 - 100 - 100)
    expect(computeScore('hard', 0, 0)).toBe(3000)
  })

  test('ne descend jamais sous 10', () => {
    expect(computeScore('easy', 100_000, 50)).toBe(10)
  })
})

describe('formatTime', () => {
  test.each([
    [0, '0:00'],
    [5, '0:05'],
    [60, '1:00'],
    [125, '2:05'],
    [3600, '60:00'],
  ])('%i s -> %s', (seconds, expected) => {
    expect(formatTime(seconds)).toBe(expected)
  })
})
