import { describe, expect, test } from 'vitest'
import { levelScore, totalScore } from './score'

describe('levelScore', () => {
  // Niveau dont le minimum est de 10 coups
  const optimal = 10

  test.each([
    { moves: 10, hints: 0, expected: 1000 }, // parfait
    { moves: 11, hints: 0, expected: 950 }, // 1 coup en trop
    { moves: 10, hints: 1, expected: 800 }, // 1 indice
    { moves: 12, hints: 2, expected: 500 }, // 2 coups en trop et 2 indices
  ])('$moves coups et $hints indice(s) → $expected points', ({ moves, hints, expected }) => {
    // Act
    const score = levelScore({ moves, optimal, hintsUsed: hints })

    // Assert
    expect(score).toBe(expected)
  })

  // Valeurs limites autour du plancher : 20 coups en trop font exactement 0
  test.each([
    { moves: 29, expected: 50 },
    { moves: 30, expected: 0 },
    { moves: 31, expected: 0 },
    { moves: 1000, expected: 0 },
  ])('le score ne descend jamais sous 0 ($moves coups → $expected)', ({ moves, expected }) => {
    // Act
    const score = levelScore({ moves, optimal, hintsUsed: 0 })

    // Assert
    expect(score).toBe(expected)
  })
})

describe('totalScore', () => {
  test('additionne les records de tous les niveaux', () => {
    // Act
    const total = totalScore({ 1: 1000, 2: 850 })

    // Assert
    expect(total).toBe(1850)
  })

  test('vaut 0 sans niveau terminé', () => {
    // Act
    const total = totalScore({})

    // Assert
    expect(total).toBe(0)
  })
})
