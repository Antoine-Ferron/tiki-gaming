import { describe, expect, test } from 'vitest'
import { recordResult } from './progress'

describe('recordResult', () => {
  test('enregistre le premier score d’un niveau', () => {
    // Act
    const result = recordResult({}, 1, 800)

    // Assert
    expect(result).toEqual({ best: { 1: 800 }, improved: true })
  })

  // Valeurs limites autour d'un record de 800 : il ne change que si le score est strictement meilleur
  test.each([
    { score: 799, kept: 800, improved: false },
    { score: 800, kept: 800, improved: false },
    { score: 801, kept: 801, improved: true },
  ])('record de 800, nouveau score $score → record $kept', ({ score, kept, improved }) => {
    // Arrange
    const best = { 1: 800 }

    // Act
    const result = recordResult(best, 1, score)

    // Assert
    expect(result).toEqual({ best: { 1: kept }, improved })
  })

  test('ne modifie pas les records reçus', () => {
    // Arrange
    const best = { 1: 800 }

    // Act
    recordResult(best, 1, 900)

    // Assert
    expect(best).toEqual({ 1: 800 })
  })
})
