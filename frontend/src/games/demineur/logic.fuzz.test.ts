import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { calculateScore, createGrid, getOutcome, revealCell, toggleFlag, type Grid } from './logic'

/**
 * Référence indépendante du calcul d'adjacentMines : ne réutilise pas countAdjacentMines de
 * logic.ts, sinon le test ne prouverait rien (il comparerait la fonction à elle-même).
 */
function referenceAdjacentMines(grid: Grid, row: number, col: number): number {
  let count = 0
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue
      if (grid[row + dr]?.[col + dc]?.mine) count++
    }
  }
  return count
}

// Densité plafonnée à 70% : au-delà, le rejet aléatoire de createGrid devient lent (beaucoup
// de tentatives pour trouver les dernières cases libres), sans rapport avec ce qu'on fuzz ici.
const gridParams = fc
  .record({ rows: fc.integer({ min: 1, max: 15 }), cols: fc.integer({ min: 1, max: 15 }) })
  .chain(({ rows, cols }) =>
    fc.record({
      rows: fc.constant(rows),
      cols: fc.constant(cols),
      mineCount: fc.integer({ min: 0, max: Math.floor(rows * cols * 0.7) }),
    }),
  )

describe('demineur: fuzzing (fast-check)', () => {
  it('createGrid produit toujours les bonnes dimensions et le bon nombre de mines', () => {
    fc.assert(
      fc.property(gridParams, ({ rows, cols, mineCount }) => {
        const grid = createGrid(rows, cols, mineCount)
        expect(grid).toHaveLength(rows)
        for (const row of grid) expect(row).toHaveLength(cols)
        expect(grid.flat().filter((cell) => cell.mine)).toHaveLength(mineCount)
      }),
    )
  })

  it('adjacentMines compte uniquement les mines voisines (vérifié par un calcul indépendant)', () => {
    fc.assert(
      fc.property(gridParams, ({ rows, cols, mineCount }) => {
        const grid = createGrid(rows, cols, mineCount)
        for (let row = 0; row < rows; row++) {
          for (let col = 0; col < cols; col++) {
            const cell = grid[row][col]
            expect(cell.adjacentMines).toBeGreaterThanOrEqual(0)
            expect(cell.adjacentMines).toBeLessThanOrEqual(8)
            if (!cell.mine) {
              expect(cell.adjacentMines).toBe(referenceAdjacentMines(grid, row, col))
            }
          }
        }
      }),
    )
  })

  it('revealCell ne plante jamais, même avec des coordonnées hors grille, et ne déplace aucune mine', () => {
    fc.assert(
      fc.property(
        gridParams,
        fc.integer({ min: -5, max: 20 }),
        fc.integer({ min: -5, max: 20 }),
        ({ rows, cols, mineCount }, row, col) => {
          const grid = createGrid(rows, cols, mineCount)
          const minesBefore = grid.flat().map((cell) => cell.mine)

          expect(() => revealCell(grid, row, col)).not.toThrow()

          expect(grid.flat().map((cell) => cell.mine)).toEqual(minesBefore)
        },
      ),
    )
  })

  it('toggleFlag ne plante jamais et est sa propre inverse sur une case juste créée', () => {
    fc.assert(
      fc.property(
        gridParams,
        fc.integer({ min: -5, max: 20 }),
        fc.integer({ min: -5, max: 20 }),
        ({ rows, cols, mineCount }, row, col) => {
          const grid = createGrid(rows, cols, mineCount)
          const cell = grid[row]?.[col]

          expect(() => {
            toggleFlag(grid, row, col)
            toggleFlag(grid, row, col)
          }).not.toThrow()

          if (cell) expect(cell.flagged).toBe(false)
        },
      ),
    )
  })

  it('calculateScore ne renvoie jamais un score négatif', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -1000, max: 100_000 }),
        fc.integer({ min: 0, max: 200 }),
        (elapsedSeconds, mineCount) => {
          expect(calculateScore(elapsedSeconds, mineCount)).toBeGreaterThanOrEqual(0)
        },
      ),
    )
  })

  it('calculateScore ne peut jamais augmenter quand le temps écoulé augmente', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1000 }),
        fc.integer({ min: 0, max: 500 }),
        fc.integer({ min: 0, max: 200 }),
        (elapsedSeconds, extraSeconds, mineCount) => {
          const sooner = calculateScore(elapsedSeconds, mineCount)
          const later = calculateScore(elapsedSeconds + extraSeconds, mineCount)
          expect(later).toBeLessThanOrEqual(sooner)
        },
      ),
    )
  })

  it('calculateScore ne peut jamais diminuer quand le nombre de mines augmente', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 200 }),
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 1000 }),
        (mineCount, extraMines, elapsedSeconds) => {
          const fewer = calculateScore(elapsedSeconds, mineCount)
          const more = calculateScore(elapsedSeconds, mineCount + extraMines)
          expect(more).toBeGreaterThanOrEqual(fewer)
        },
      ),
    )
  })

  it('getOutcome renvoie toujours un état valide', () => {
    fc.assert(
      fc.property(gridParams, ({ rows, cols, mineCount }) => {
        const grid = createGrid(rows, cols, mineCount)
        expect(['playing', 'won', 'lost']).toContain(getOutcome(grid))
      }),
    )
  })
})
