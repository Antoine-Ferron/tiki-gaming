import { describe, expect, test } from 'vitest'
import { seededRandom } from '../testing/seededRandom'
import { parseBoard } from './board'
import { type Difficulty, difficultyOf } from './difficulty'
import { generateBoard } from './generator'
import { solve } from './solver'

const DIFFICULTIES: Difficulty[] = ['facile', 'moyen', 'difficile']
// Chaque génération explore des milliers de positions (~0,2 s) : 3 graines par difficulté suffisent.
const SEEDS = [1, 2, 3]

describe('generateBoard : un plateau tiré au hasard, de la difficulté demandée (G2, G3)', () => {
  // Le hasard est injecté : une graine fixe rend chaque test reproductible.
  test.each(DIFFICULTIES.flatMap((difficulty) => SEEDS.map((seed) => ({ difficulty, seed }))))(
    '$difficulty, graine $seed : plateau valide, résoluble et de la bonne difficulté',
    ({ difficulty, seed }) => {
      // Act
      const map = generateBoard(difficulty, seededRandom(seed))

      // Assert
      const solution = solve(parseBoard(map))
      expect(solution).not.toBeNull()
      expect(difficultyOf(solution!.length)).toBe(difficulty)
    },
  )

  test('même graine → même plateau', () => {
    // Act
    const first = generateBoard('moyen', seededRandom(42))
    const second = generateBoard('moyen', seededRandom(42))

    // Assert
    expect(first).toEqual(second)
  })

  test('des graines différentes donnent des plateaux variés', () => {
    // Act
    const maps = [1, 2, 3, 4, 5].map((seed) => generateBoard('difficile', seededRandom(seed)).join(''))

    // Assert
    expect(new Set(maps).size).toBeGreaterThanOrEqual(4)
  })
})

describe('generateBoard : rapidité (G4)', () => {
  test('un plateau Difficile est généré en moins de 2 secondes', () => {
    // Arrange
    const start = performance.now()

    // Act
    generateBoard('difficile', seededRandom(7))

    // Assert
    expect(performance.now() - start).toBeLessThan(2000)
  })
})
