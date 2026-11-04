import { describe, expect, test } from 'vitest'
import { canMove, maxTile, moveGrid, type Direction } from './board'

const grid = [
  [2, 0, 2, 4],
  [0, 4, 0, 4],
  [2, 0, 0, 8],
  [2, 4, 8, 8],
]

describe('moveGrid', () => {
  test.each<{ direction: Direction; after: number[][]; points: number }>([
    {
      direction: 'left',
      after: [
        [4, 4, 0, 0],
        [8, 0, 0, 0],
        [2, 8, 0, 0],
        [2, 4, 16, 0],
      ],
      points: 4 + 8 + 16,
    },
    {
      direction: 'right',
      after: [
        [0, 0, 4, 4],
        [0, 0, 0, 8],
        [0, 0, 2, 8],
        [0, 2, 4, 16],
      ],
      points: 4 + 8 + 16,
    },
    {
      direction: 'up',
      after: [
        [4, 8, 2, 8],
        [2, 0, 8, 16],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ],
      points: 4 + 8 + 8 + 16,
    },
    {
      direction: 'down',
      after: [
        [0, 0, 0, 0],
        [0, 0, 0, 8],
        [2, 0, 2, 8],
        [4, 8, 8, 16],
      ],
      points: 4 + 8 + 8 + 16,
    },
  ])('vers $direction', ({ direction, after, points }) => {
    // Act
    const result = moveGrid(grid, direction)

    // Assert
    expect(result).toEqual({ grid: after, points, moved: true })
  })

  test('un coup qui ne bouge aucune tuile renvoie la même grille, sans point', () => {
    // Arrange
    const packed = [
      [2, 4, 0, 0],
      [8, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]

    // Act
    const result = moveGrid(packed, 'left')

    // Assert
    expect(result).toEqual({ grid: packed, points: 0, moved: false })
  })

  test('ne modifie pas la grille reçue', () => {
    // Arrange
    const before = grid.map((row) => [...row])

    // Act
    moveGrid(grid, 'left')

    // Assert
    expect(grid).toEqual(before)
  })
})

describe('canMove', () => {
  test.each([
    {
      label: 'une case vide',
      grid: [
        [2, 4, 2, 4],
        [4, 2, 4, 2],
        [2, 4, 2, 4],
        [4, 2, 4, 0],
      ],
      expected: true,
    },
    {
      label: 'pleine avec une paire sur une ligne',
      grid: [
        [2, 4, 2, 4],
        [4, 2, 4, 2],
        [2, 4, 2, 4],
        [4, 2, 2, 4],
      ],
      expected: true,
    },
    {
      label: 'pleine avec une paire sur une colonne',
      grid: [
        [2, 4, 2, 4],
        [4, 2, 4, 2],
        [2, 4, 2, 4],
        [2, 8, 16, 2],
      ],
      expected: true,
    },
    {
      label: 'pleine sans aucune paire',
      grid: [
        [2, 4, 2, 4],
        [4, 2, 4, 2],
        [2, 4, 2, 4],
        [4, 2, 4, 2],
      ],
      expected: false,
    },
  ])('grille $label → $expected', ({ grid, expected }) => {
    // Act
    const result = canMove(grid)

    // Assert
    expect(result).toBe(expected)
  })
})

describe('maxTile', () => {
  test.each([
    {
      grid: [
        [0, 0],
        [0, 0],
      ],
      expected: 0,
    },
    {
      grid: [
        [2, 0],
        [0, 4],
      ],
      expected: 4,
    },
    {
      grid: [
        [1024, 2048],
        [8, 2],
      ],
      expected: 2048,
    },
  ])('plus grande tuile de $grid → $expected', ({ grid, expected }) => {
    // Act
    const result = maxTile(grid)

    // Assert
    expect(result).toBe(expected)
  })
})
