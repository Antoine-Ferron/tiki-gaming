// Propriétés du barème (§ 7) vérifiées avec fast-check, en complément des valeurs limites de score.test.ts.
import fc from 'fast-check'
import { describe, expect, test } from 'vitest'
import { levelScore } from './score'

// Une partie possible : un minimum de coups, des coups en trop, des indices.
const game = fc.record({
  optimal: fc.integer({ min: 1, max: 40 }),
  extra: fc.integer({ min: 0, max: 60 }),
  hintsUsed: fc.integer({ min: 0, max: 10 }),
})

describe('levelScore (propriétés)', () => {
  test('le score d’une partie possible est toujours un entier entre 0 et 1000', () => {
    fc.assert(
      fc.property(game, ({ optimal, extra, hintsUsed }) => {
        // Act
        const score = levelScore({ moves: optimal + extra, optimal, hintsUsed })

        // Assert
        expect(Number.isInteger(score)).toBe(true)
        expect(score).toBeGreaterThanOrEqual(0)
        expect(score).toBeLessThanOrEqual(1000)
      }),
    )
  })

  test('un coup en trop ou un indice de plus ne fait jamais monter le score', () => {
    fc.assert(
      fc.property(game, ({ optimal, extra, hintsUsed }) => {
        // Arrange
        const score = levelScore({ moves: optimal + extra, optimal, hintsUsed })

        // Act
        const oneMoreMove = levelScore({ moves: optimal + extra + 1, optimal, hintsUsed })
        const oneMoreHint = levelScore({ moves: optimal + extra, optimal, hintsUsed: hintsUsed + 1 })

        // Assert
        expect(oneMoreMove).toBeLessThanOrEqual(score)
        expect(oneMoreHint).toBeLessThanOrEqual(score)
      }),
    )
  })
})
