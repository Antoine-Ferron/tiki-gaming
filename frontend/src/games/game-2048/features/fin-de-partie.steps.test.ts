import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber'
import { expect } from 'vitest'
import { GameError, MESSAGES } from '../../errors'
import { createGameContext } from '../../sdk'
import { FakeScores, fakeDeps } from '../../testing/fakes'
import type { GameContext } from '../../types'
import type { GameState } from '../domain/game'
import { finishGame } from '../services/finishGame'

const feature = await loadFeature('src/games/game-2048/features/fin-de-partie.feature', { language: 'fr' })

const game = { slug: 'game-2048' }
const player = { id: 'p1', username: 'evan' }

function finished(score: number): GameState {
  return {
    grid: [
      [2048, 0],
      [0, 0],
    ],
    score,
    moves: 1,
    status: 'lost',
    continued: false,
  }
}

describeFeature(feature, ({ Scenario }) => {
  let scores: FakeScores
  let deps: ReturnType<typeof fakeDeps>
  let ctx: GameContext
  let error: Error | null

  function connect(asPlayer: boolean) {
    scores = new FakeScores(player)
    deps = fakeDeps({ scores })
    ctx = createGameContext(game, asPlayer ? player : null, deps)
    error = null
  }

  async function finish(_: unknown, score: number) {
    try {
      await finishGame(ctx, finished(score))
    } catch (err) {
      error = err as Error
    }
  }

  async function record() {
    return ((await ctx.loadSave()) as { best?: number } | null)?.best
  }

  const sentScores = () => scores.rows.map((r) => r.score)

  Scenario("Le score d'un joueur connecté est envoyé au classement", ({ Given, When, Then, And }) => {
    Given('un joueur connecté', () => connect(true))
    When('il termine une partie avec un score de {int} points', finish)
    Then('un score de {int} points est envoyé au classement', (_, score: number) => {
      expect(sentScores()).toEqual([score])
    })
    And('son record est de {int} points', async (_, best: number) => {
      expect(await record()).toBe(best)
    })
  })

  Scenario('Une partie moins bonne ne fait pas baisser le record', ({ Given, And, When, Then }) => {
    Given('un joueur connecté', () => connect(true))
    And('son record actuel est de {int} points', (_, best: number) => {
      deps.saves.data.set('game-2048', { version: 1, best })
    })
    When('il termine une partie avec un score de {int} points', finish)
    Then('un score de {int} points est envoyé au classement', (_, score: number) => {
      expect(sentScores()).toEqual([score])
    })
    And('son record est de {int} points', async (_, best: number) => {
      expect(await record()).toBe(best)
    })
  })

  Scenario('Un invité garde son record sans apparaître au classement', ({ Given, When, Then, And }) => {
    Given('un invité', () => connect(false))
    When('il termine une partie avec un score de {int} points', finish)
    Then("aucun score n'est envoyé au classement", () => {
      expect(sentScores()).toEqual([])
    })
    And('son record est de {int} points', async (_, best: number) => {
      expect(await record()).toBe(best)
    })
  })

  Scenario('Un score refusé par le classement ne devient pas le record', ({ Given, And, When, Then }) => {
    Given('un joueur connecté', () => connect(true))
    And('le classement refuse le prochain score', () => {
      scores.failNext(new GameError('forbidden', MESSAGES.forbidden))
    })
    When('il termine une partie avec un score de {int} points', finish)
    Then("il voit le message d'erreur du classement", () => {
      expect(error?.message).toBe(MESSAGES.forbidden)
    })
    And("il n'a pas encore de record", async () => {
      expect(await record()).toBeUndefined()
    })
  })

  Scenario(
    'Pendant une coupure réseau, le record est gardé et le score sera envoyé plus tard',
    ({ Given, And, When, Then }) => {
      Given('un joueur connecté', () => connect(true))
      And('la connexion est coupée', () => {
        scores.failNext(new GameError('network', 'hors ligne'))
      })
      When('il termine une partie avec un score de {int} points', finish)
      Then('il est prévenu que son score sera envoyé plus tard', () => {
        expect(error?.message).toBe(MESSAGES.queued)
      })
      And('son record est de {int} points', async (_, best: number) => {
        expect(await record()).toBe(best)
      })
    },
  )
})
