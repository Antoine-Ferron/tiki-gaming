import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber'
import { expect } from 'vitest'
import { GameError } from '../../errors'
import { createGameContext } from '../../sdk'
import { FakeScores, fakeDeps } from '../../testing/fakes'
import type { GameContext } from '../../types'
import type { Move } from '../domain/board'
import { completeLevel } from '../services/completeLevel'
import { scoreWithOptimal } from '../testing/verifiers'

const feature = await loadFeature('src/games/rush-hour/features/fin-de-niveau.feature', { language: 'fr' })

const game = { slug: 'rush-hour', scoreLimits: { max: 20000 } }
const player = { id: 'p1', username: 'tanguy' }

function moves(count: number): Move[] {
  return Array.from({ length: count }, () => ({ id: 'X', delta: 1 }))
}

// Les nombres (niveau, coups, record, score) sont lus dans le texte des étapes avec {int} :
// si le .feature change, le test exécute la nouvelle valeur, le texte ne peut pas mentir.
describeFeature(feature, ({ Background, Scenario, ScenarioOutline }) => {
  let scores: FakeScores
  let deps: ReturnType<typeof fakeDeps>
  let ctx: GameContext
  let optimal: number
  let outcome: { score: number } | { error: string }

  async function finish(level: number, moveCount: number, hintsUsed = 0) {
    try {
      const run = { level, moves: moves(moveCount), hintsUsed, durationMs: 0 }
      // Fake du serveur : il calcule le score avec le barème, pour le minimum donné par le Contexte
      const result = await completeLevel(ctx, run, scoreWithOptimal(optimal))
      outcome = { score: result.score }
    } catch (err) {
      outcome = { error: (err as Error).message }
    }
  }

  function savedRecord(level: number): number | undefined {
    const save = deps.saves.data.get('rush-hour') as { best?: Record<number, number> } | undefined
    return save?.best?.[level]
  }

  const sentTotals = () => scores.rows.map((r) => r.score)

  // Rejoué avant chaque scénario : chacun part d'un état neuf (fakes en mémoire, aucun réseau).
  Background(({ Given, And }) => {
    Given('un joueur connecté', () => {
      scores = new FakeScores(player)
      deps = fakeDeps({ scores })
      ctx = createGameContext(game, player, deps)
    })
    And('le niveau {int}, dont le minimum est de {int} coups', (_, _level: number, minimum: number) => {
      optimal = minimum
    })
  })

  Scenario('Un nouveau record est gardé et envoyé au classement', ({ Given, When, Then, And }) => {
    Given('son record sur le niveau {int} est de {int} points', (_, level: number, record: number) => {
      deps.saves.data.set('rush-hour', { version: 1, best: { [level]: record } })
    })
    When('il termine le niveau {int} en {int} coups', (_, level: number, count: number) => finish(level, count))
    Then('son record sur le niveau {int} est de {int} points', (_, level: number, record: number) => {
      expect(savedRecord(level)).toBe(record)
    })
    And('son score total de {int} points est envoyé au classement', (_, total: number) => {
      expect(sentTotals()).toEqual([total])
    })
  })

  Scenario("Un record refusé par le classement n'est pas gardé", ({ Given, When, Then }) => {
    Given('le classement refuse le prochain score', () => {
      scores.failNext(new GameError('forbidden', 'refusé'))
    })
    When('il termine le niveau {int} en {int} coups', (_, level: number, count: number) => finish(level, count))
    Then("son record sur le niveau {int} n'est pas gardé", (_, level: number) => {
      expect(savedRecord(level)).toBeUndefined()
    })
    When('il termine à nouveau le niveau {int} en {int} coups', (_, level: number, count: number) =>
      finish(level, count),
    )
    Then('son score total de {int} points est envoyé au classement', (_, total: number) => {
      expect(sentTotals()).toEqual([total])
    })
  })

  ScenarioOutline("Le score d'un niveau dépend des coups en trop et des indices", ({ When, Then }, variables) => {
    When('il termine le niveau 1 en <coups> coups avec <indices> indice(s)', () =>
      finish(1, Number(variables.coups), Number(variables.indices)),
    )
    Then('son score sur le niveau est de <score>', () => {
      // « refusé » = refus par la garde du barème, pas n'importe quelle panne
      if (variables.score === 'refusé')
        expect(outcome).toEqual({ error: expect.stringContaining('Nombre de coups impossible') })
      else expect(outcome).toEqual({ score: Number(variables.score) })
    })
  })
})
