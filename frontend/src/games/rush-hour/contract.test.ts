import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { parseBoard } from './domain/board'
import { levels } from './domain/levels'
import { levelScore } from './domain/score'
import { GameSession } from './domain/session'
import { solve } from './domain/solver'
import { ManualClock } from './testing/manualClock'

/**
 * Contrat partagé avec le serveur (shared/games/rush-hour/contrat.json) : le backend Java rejoue les mêmes
 * exemples (ContractTest). Si le jeu et le serveur divergent, l'une des deux suites échoue.
 */
type Result = { coups: number } | { score: number } | { refus: string }
type Contract = {
  niveaux: { numero: number; minimum: number; map: string[] }[]
  parties: { nom: string; map: string[]; coups: { vehicule: string; delta: number }[]; resultat: Result }[]
  bareme: { coups: number; minimum: number; indices: number; resultat: Result }[]
}

const CONTRACT = 'shared/games/rush-hour/contrat.json'

/**
 * Cherche le contrat en remontant les dossiers : un chemin fixe (`../../../..`) casse dès que le test tourne
 * ailleurs que dans le dépôt, par exemple dans le bac à sable de Stryker (frontend/.stryker-tmp/sandbox-…).
 */
function findContract(dir = dirname(fileURLToPath(import.meta.url))): string {
  const candidate = join(dir, CONTRACT)
  if (existsSync(candidate)) return candidate
  if (dirname(dir) === dir) throw new Error(`Contrat introuvable : ${CONTRACT}`)
  return findContract(dirname(dir))
}

const contract: Contract = JSON.parse(readFileSync(findContract(), 'utf8'))

/** Rejoue une partie avec le moteur du jeu, comme le serveur le fait avec la sienne. */
function replay(map: string[], moves: Contract['parties'][number]['coups']): Result {
  const session = new GameSession(map, new ManualClock())
  try {
    for (const move of moves) session.move(move.vehicule, move.delta)
  } catch (e) {
    return { refus: (e as Error).message }
  }
  return session.solved ? { coups: session.moveCount } : { refus: 'La voiture rouge n’est pas sortie' }
}

describe('contrat partagé avec le serveur : niveaux', () => {
  test('le jeu a exactement les niveaux du contrat, case par case', () => {
    // Act
    const maps = levels.map((level) => level.map)

    // Assert
    expect(maps).toEqual(contract.niveaux.map((n) => n.map))
  })

  test.each(contract.niveaux)('le niveau $numero se résout au minimum en $minimum coups', ({ map, minimum }) => {
    // Act
    const solution = solve(parseBoard(map))

    // Assert
    expect(solution).toHaveLength(minimum)
  })
})

describe('contrat partagé avec le serveur : parties rejouées', () => {
  test.each(contract.parties)('$nom', ({ map, coups, resultat }) => {
    // Act
    const result = replay(map, coups)

    // Assert
    expect(result).toEqual(resultat)
  })
})

describe('contrat partagé avec le serveur : barème', () => {
  test.each(contract.bareme)(
    '$coups coups, minimum $minimum, $indices indice(s)',
    ({ coups, minimum, indices, resultat }) => {
      // Act
      let result: Result
      try {
        result = { score: levelScore({ moves: coups, optimal: minimum, hintsUsed: indices }) }
      } catch (e) {
        result = { refus: (e as Error).message }
      }

      // Assert
      expect(result).toEqual(resultat)
    },
  )
})
