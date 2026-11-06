import { describe, expect, test } from 'vitest'
import { randomSpawner } from './spawner'

/** Stub du hasard : renvoie les tirages donnés, dans l'ordre (case choisie, puis valeur de la tuile). */
function stubRandom(...draws: number[]) {
  return () => {
    const draw = draws.shift()
    if (draw === undefined) throw new Error('Tirage non prévu par le test')
    return draw
  }
}

const grid = [
  [2, 0],
  [0, 4],
]

describe('randomSpawner', () => {
  test.each([
    { draw: 0, cell: [0, 1] },
    { draw: 0.49, cell: [0, 1] },
    { draw: 0.5, cell: [1, 0] },
    { draw: 0.99, cell: [1, 0] },
  ])('le tirage $draw choisit la case vide $cell', ({ draw, cell: [row, column] }) => {
    // Arrange
    const spawner = randomSpawner(stubRandom(draw, 0))

    // Act
    const result = spawner.spawn(grid)

    // Assert
    expect(result[row][column]).toBe(2)
    expect(result.flat().filter((value) => value === 0)).toHaveLength(1)
  })

  test.each([
    { draw: 0, value: 2 },
    { draw: 0.89, value: 2 },
    { draw: 0.9, value: 4 },
    { draw: 0.99, value: 4 },
  ])('le tirage $draw donne une tuile de $value (R6 : 2 dans 90 % des cas)', ({ draw, value }) => {
    // Arrange
    const spawner = randomSpawner(stubRandom(0, draw))

    // Act
    const result = spawner.spawn(grid)

    // Assert
    expect(result[0][1]).toBe(value)
  })

  test('ne touche pas aux tuiles déjà posées ni à la grille reçue', () => {
    // Arrange
    const spawner = randomSpawner(stubRandom(0, 0))

    // Act
    const result = spawner.spawn(grid)

    // Assert
    expect(result).toEqual([
      [2, 2],
      [0, 4],
    ])
    expect(grid).toEqual([
      [2, 0],
      [0, 4],
    ])
  })

  test('une grille pleine reste telle quelle, sans tirage', () => {
    // Arrange
    const full = [
      [2, 4],
      [8, 16],
    ]
    const spawner = randomSpawner(stubRandom())

    // Act
    const result = spawner.spawn(full)

    // Assert
    expect(result).toEqual(full)
  })
})
