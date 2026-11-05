import { describe, expect, test } from 'vitest'
import { seededRandom } from '../testing/seededRandom'
import { type Board, parseBoard } from './board'
import { type Difficulty, difficultyOf } from './difficulty'
import { generateBoard } from './generator'
import { GENERATOR_LAYOUTS } from './generatorLayouts'
import { solve } from './solver'

const DIFFICULTIES: Difficulty[] = ['facile', 'moyen', 'difficile']
const SEEDS = [1, 2, 3]

// Explorer une disposition de la réserve prend un temps qui dépend de la machine (0,1 à 1 s), puis elle reste en
// mémoire. Le premier test qui tire une disposition paie ce temps : délai large pour ne pas dépendre de la vitesse de
// la machine (un test qui en dépend est instable). Pas de préchauffage dans un beforeAll : Stryker y verrait du code
// « statique » et relancerait toute la suite pour chaque mutant du générateur.
const EXPLORATION = { timeout: 30_000 }

describe('generateBoard : un plateau tiré au hasard, de la difficulté demandée (G2, G3)', EXPLORATION, () => {
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

/** Ce qui ne change jamais dans une disposition : chaque véhicule, son sens et la ligne (ou colonne) qu'il occupe. */
function layoutOf(board: Board) {
  return board.vehicles.map((v) => `${v.id}${v.orientation}${v.length}@${v.orientation === 'H' ? v.row : v.col}`).sort()
}

describe('generateBoard : toute la réserve sert (G3)', EXPLORATION, () => {
  test.each(GENERATOR_LAYOUTS.map((map, index) => ({ map, index })))(
    'le tirage peut choisir la disposition n°$index',
    ({ map, index }) => {
      // Arrange : un hasard qui tombe sur cette disposition
      const random = () => (index + 0.5) / GENERATOR_LAYOUTS.length

      // Act
      const generated = generateBoard('facile', random)

      // Assert : mêmes véhicules, sur les mêmes lignes et colonnes ; seules leurs positions changent
      expect(layoutOf(parseBoard(generated))).toEqual(layoutOf(parseBoard(map)))
    },
  )
})
