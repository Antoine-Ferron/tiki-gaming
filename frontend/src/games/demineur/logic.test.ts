import { describe, expect, it } from 'vitest'
import { createGrid, type Rng } from './logic'

describe('demineur: génération de grille', () => {
  it('crée une grille aux dimensions demandées', () => {
    // Arrange
    const rows = 9
    const cols = 9
    const mineCount = 10

    // Act
    const grid = createGrid(rows, cols, mineCount)

    // Assert
    expect(grid).toHaveLength(rows)
    for (const row of grid) {
      expect(row).toHaveLength(cols)
    }
  })

  it('place exactement le nombre de mines demandé', () => {
    // Arrange
    const mineCount = 10

    // Act
    const grid = createGrid(9, 9, mineCount)

    // Assert
    const placedMines = grid.flat().filter((cell) => cell.mine).length
    expect(placedMines).toBe(mineCount)
  })

  it('place les mines aux positions fournies par le générateur injecté (Stub)', () => {
    // Arrange : Stub Rng à séquence fixe -> toujours la case (0, 0) sur une grille 2x2
    const stubRng: Rng = { next: () => 0 }

    // Act
    const grid = createGrid(2, 2, 1, stubRng)

    // Assert : vérification d'état, pas d'interaction avec le Stub
    expect(grid[0][0].mine).toBe(true)
    const placedMines = grid.flat().filter((cell) => cell.mine).length
    expect(placedMines).toBe(1)
  })
})

describe('demineur: robustesse (zéro flakiness avec le vrai aléatoire)', () => {
  it('respecte les invariants de grille sur 100 exécutions avec realRng', () => {
    // Arrange
    const iterations = 100
    const rows = 9
    const cols = 9
    const mineCount = 10

    for (let i = 0; i < iterations; i++) {
      // Act : pas de Stub ici, on veut le vrai Math.random (comportement de production)
      const grid = createGrid(rows, cols, mineCount)

      // Assert : invariants qui doivent tenir quel que soit le tirage
      expect(grid).toHaveLength(rows)
      for (const row of grid) {
        expect(row).toHaveLength(cols)
      }
      const placedMines = grid.flat().filter((cell) => cell.mine).length
      expect(placedMines).toBe(mineCount)
    }
  })
})
