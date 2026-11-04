import { describe, expect, test } from 'vitest'
import { parseBoard } from './board'
import { difficultyOf } from './difficulty'
import { getLevel, levels } from './levels'
import { solve } from './solver'

// Minimum de coups de chaque niveau, calculé une seule fois par le solveur (vérité des données).
const optimalOf = new Map(levels.map((level) => [level.id, solve(parseBoard(level.map))?.length ?? null]))

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
    const optimal = optimalOf.get(id)

    // Assert
    expect(optimal).not.toBeNull()
  })

  test.each(levels.map((level) => level.id))('le niveau %i a la difficulté attendue pour son numéro', (id) => {
    // Act
    const difficulty = difficultyOf(optimalOf.get(id) ?? 0)

    // Assert
    expect(difficulty).toBe(expectedDifficulty(id))
  })

  test('le minimum de coups ne diminue jamais d’un niveau au suivant', () => {
    // Act
    const optimals = levels.map((level) => optimalOf.get(level.id) ?? 0)

    // Assert
    expect(optimals).toEqual([...optimals].sort((a, b) => a - b))
  })

  // Même liste que backend/src/test/java/fr/tikigaming/games/rush_hour/LevelsTest.java : le serveur, qui vérifie
  // les parties, doit connaître exactement les mêmes niveaux. Changer un niveau d'un seul côté fait échouer un test.
  test('les minimums de coups sont ceux connus du serveur', () => {
    // Act
    const optimals = levels.map((level) => optimalOf.get(level.id))

    // Assert
    expect(optimals).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 17, 18, 19, 20, 22, 24, 26])
  })
})
