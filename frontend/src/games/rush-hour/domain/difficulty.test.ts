import { describe, expect, test } from 'vitest'
import { difficultyOf } from './difficulty'

describe('difficultyOf : la difficulté dépend du minimum de coups (§ 5)', () => {
  // Valeurs limites à chaque frontière : 2|3, 8|9, 16|17
  test.each([
    { optimal: 2, expected: null }, // trop facile : refusé
    { optimal: 3, expected: 'facile' },
    { optimal: 8, expected: 'facile' },
    { optimal: 9, expected: 'moyen' },
    { optimal: 16, expected: 'moyen' },
    { optimal: 17, expected: 'difficile' },
    { optimal: 40, expected: 'difficile' },
  ])('$optimal coups minimum → $expected', ({ optimal, expected }) => {
    // Act
    const difficulty = difficultyOf(optimal)

    // Assert
    expect(difficulty).toBe(expected)
  })
})
