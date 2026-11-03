import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber'
import { expect } from 'vitest'
import { GameError } from '../../errors'
import { createGameContext } from '../../sdk'
import { FakeScores, fakeDeps } from '../../testing/fakes'
import type { GameContext } from '../../types'
import type { Move } from '../domain/board'
import { completeLevel } from '../services/completeLevel'

const feature = await loadFeature('src/games/rush-hour/features/fin-de-niveau.feature', { language: 'fr' })

const game = { slug: 'rush-hour', scoreLimits: { max: 20000 } }
const player = { id: 'p1', username: 'tanguy' }
const LEVEL = 1
const OPTIMAL = 10

function moves(count: number): Move[] {
  return Array.from({ length: count }, () => ({ id: 'X', delta: 1 }))
}

describeFeature(feature, ({ Background, Scenario, ScenarioOutline }) => {
  let scores: FakeScores
  let deps: ReturnType<typeof fakeDeps>
  let ctx: GameContext
  let outcome: { score: number } | { refused: true }

  async function finish(moveCount: number, hintsUsed = 0) {
    try {
      const result = await completeLevel(ctx, {
        level: LEVEL,
        optimal: OPTIMAL,
        moves: moves(moveCount),
        hintsUsed,
        durationMs: 0,
      })
      outcome = { score: result.score }
    } catch {
      outcome = { refused: true }
    }
  }

  function savedRecord(): number | undefined {
    const save = deps.saves.data.get('rush-hour') as { best?: Record<number, number> } | undefined
    return save?.best?.[LEVEL]
  }

  // Rejoué avant chaque scénario : chacun part d'un état neuf (fakes en mémoire, aucun réseau).
  Background(({ Given, And }) => {
    Given('un joueur connecté', () => {
      scores = new FakeScores(player)
      deps = fakeDeps({ scores })
      ctx = createGameContext(game, player, deps)
    })
    And('le niveau 1, dont le minimum est de 10 coups', () => {})
  })

  Scenario('Un nouveau record est gardé et envoyé au classement', ({ Given, When, Then, And }) => {
    Given('son record sur le niveau 1 est de 800 points', () => {
      deps.saves.data.set('rush-hour', { version: 1, best: { [LEVEL]: 800 } })
    })
    When('il termine le niveau 1 en 13 coups', () => finish(13))
    Then('son record sur le niveau 1 est de 850 points', () => {
      expect(savedRecord()).toBe(850)
    })
    And('son score total de 850 points est envoyé au classement', () => {
      expect(scores.rows.map((r) => r.score)).toEqual([850])
    })
  })

  Scenario("Un record refusé par le classement n'est pas gardé", ({ Given, When, Then }) => {
    Given('le classement refuse le prochain score', () => {
      scores.failNext(new GameError('forbidden', 'refusé'))
    })
    When('il termine le niveau 1 en 10 coups', () => finish(10))
    Then("son record sur le niveau 1 n'est pas gardé", () => {
      expect(savedRecord()).toBeUndefined()
    })
    When('il termine à nouveau le niveau 1 en 10 coups', () => finish(10))
    Then('son score total de 1000 points est envoyé au classement', () => {
      expect(scores.rows.map((r) => r.score)).toEqual([1000])
    })
  })

  ScenarioOutline("Le score d'un niveau dépend des coups en trop et des indices", ({ When, Then }, variables) => {
    When('il termine le niveau 1 en <coups> coups avec <indices> indice(s)', () =>
      finish(Number(variables.coups), Number(variables.indices)),
    )
    Then('son score sur le niveau est de <score>', () => {
      if (variables.score === 'refusé') expect(outcome).toEqual({ refused: true })
      else expect(outcome).toEqual({ score: Number(variables.score) })
    })
  })
})
