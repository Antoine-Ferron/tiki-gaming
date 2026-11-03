import { fileURLToPath } from 'node:url'
import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber'
import { expect } from 'vitest'
import { GameError } from '../errors'
import { createGameContext } from '../sdk'
import { FakeScores, fakeDeps } from '../testing/fakes'
import type { GameContext } from '../types'

const feature = await loadFeature(fileURLToPath(new URL('./scores.feature', import.meta.url)), { language: 'fr' })

const player = { id: 'p1', username: 'alice' }
const game = (max: number) => ({ slug: 'clicker', scoreLimits: { max } })

describeFeature(feature, ({ Scenario, ScenarioOutline }) => {
  ScenarioOutline("Bornes d'un score", ({ Given, When, Then }, variables) => {
    const scores = new FakeScores(player)
    let ctx: GameContext
    let outcome: Promise<boolean>

    Given('un joueur connecté sur un jeu dont le score maximal est <max>', () => {
      ctx = createGameContext(game(Number(variables.max)), player, fakeDeps({ scores }))
    })
    When('il termine une partie avec <score> points', () => {
      outcome = ctx.submitScore(Number(variables.score))
    })
    Then('le score est <résultat>', async () => {
      if (variables['résultat'] === 'accepté') {
        await expect(outcome).resolves.toBe(true)
        expect(scores.rows.map((r) => r.score)).toEqual([Number(variables.score)])
      } else {
        await expect(outcome).rejects.toMatchObject({ code: 'invalid' })
        expect(scores.rows).toEqual([])
      }
    })
  })

  Scenario('Un invité joue sans être classé', ({ Given, When, Then }) => {
    const scores = new FakeScores()
    let ctx: GameContext
    let outcome: boolean

    Given('un invité sur un jeu dont le score maximal est 300', () => {
      ctx = createGameContext(game(300), null, fakeDeps({ scores }))
    })
    When('il termine une partie avec 120 points', async () => {
      outcome = await ctx.submitScore(120)
    })
    Then("le score n'est pas enregistré", () => {
      expect(outcome).toBe(false)
      expect(scores.rows).toEqual([])
    })
  })

  Scenario('Une coupure réseau ne fait pas perdre le score', ({ Given, And, When, Then }) => {
    const scores = new FakeScores(player)
    let ctx: GameContext
    let error: unknown

    Given('un joueur connecté sur un jeu dont le score maximal est 300', () => {
      ctx = createGameContext(game(300), player, fakeDeps({ scores }))
    })
    And('le réseau est coupé', () => {
      scores.failNext(new GameError('network', 'hors ligne'))
    })
    When('il termine une partie avec 120 points', async () => {
      error = await ctx.submitScore(120).catch((e: unknown) => e)
    })
    Then("il est prévenu que son score est gardé sur l'appareil", () => {
      expect(error).toMatchObject({ code: 'queued', message: expect.stringContaining('gardé sur cet appareil') })
    })
    When("le réseau revient et qu'il termine une partie avec 80 points", async () => {
      await ctx.submitScore(80)
    })
    Then('ses scores 120 et 80 sont enregistrés', () => {
      expect(scores.rows.map((r) => r.score)).toEqual([120, 80])
    })
  })
})
