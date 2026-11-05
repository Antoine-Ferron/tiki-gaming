import { describe, expect, test } from 'vitest'
import { parseBoard } from './board'
import { difficultyOf } from './difficulty'
import { getLevel, levels } from './levels'
import { solve } from './solver'

// Minimum de coups de chaque niveau, calculé par le solveur (vérité des données) au premier besoin, dans un test, puis
// gardé. Calculé au chargement du fichier, il rendrait « statiques » les mutants du solveur pour Stryker.
const optimalCache = new Map<number, number | null>()
function optimalOf(id: number): number | null {
  if (!optimalCache.has(id)) optimalCache.set(id, solve(parseBoard(getLevel(id).map))?.length ?? null)
  return optimalCache.get(id)!
}

/** Difficulté attendue d'après le numéro du niveau (N2). */
function expectedDifficulty(id: number) {
  if (id <= 6) return 'facile'
  if (id <= 13) return 'moyen'
  return 'difficile'
}

describe('catalogue des niveaux (N1, N2, N6)', () => {
  test('il y a exactement 20 niveaux, numérotés de 1 à 20', () => {
    // Act
    const ids = levels.map((level) => level.id)

    // Assert
    expect(ids).toEqual(Array.from({ length: 20 }, (_, i) => i + 1))
  })

  test('getLevel renvoie le niveau demandé', () => {
    // Act
    const level = getLevel(7)

    // Assert
    expect(level.id).toBe(7)
  })

  test.each(levels.map((level) => level.id))('le niveau %i est valide et résoluble', (id) => {
    // Act
    const optimal = optimalOf(id)

    // Assert
    expect(optimal).not.toBeNull()
  })

  test.each(levels.map((level) => level.id))('le niveau %i a la difficulté attendue pour son numéro', (id) => {
    // Act
    const difficulty = difficultyOf(optimalOf(id) ?? 0)

    // Assert
    expect(difficulty).toBe(expectedDifficulty(id))
  })

  test('le minimum de coups ne diminue jamais d’un niveau au suivant', () => {
    // Act
    const optimals = levels.map((level) => optimalOf(level.id) ?? 0)

    // Assert
    expect(optimals).toEqual([...optimals].sort((a, b) => a - b))
  })
})
