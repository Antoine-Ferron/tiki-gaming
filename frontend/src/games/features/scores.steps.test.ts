import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber'
import { expect } from 'vitest'
import { GameError } from '../errors'
import { createGameContext } from '../sdk'
import { FakeScores, fakeDeps } from '../testing/fakes'
import type { GameContext } from '../types'

const feature = await loadFeature('src/games/features/scores.feature', { language: 'fr' })

const player = { id: 'p1', username: 'alice' }

describeFeature(feature, ({ Background, Scenario, ScenarioOutline }) => {
  let scores: FakeScores
  let ctx: GameContext
  let outcome: { accepted: true } | { accepted: false; message: string }

  async function finish(score: number) {
    try {
      await ctx.submitScore(score)
      outcome = { accepted: true }
    } catch (err) {
      outcome = { accepted: false, message: (err as Error).message }
    }
  }

  Background(({ Given, And }) => {
    Given('un jeu dont le score maximal est 300', () => {
      scores = new FakeScores(player)
    })
    And('un joueur connecté', () => {
      ctx = createGameContext({ slug: 'clicker', scoreLimits: { max: 300 } }, player, fakeDeps({ scores }))
    })
  })

  ScenarioOutline('Un score est accepté seulement entre 0 et le maximum du jeu', ({ When, Then }, variables) => {
    When('le joueur termine une partie avec un score de <score>', () => finish(Number(variables.score)))
    Then('le score est <résultat>', () => {
      expect(outcome.accepted).toBe(variables['résultat'] === 'accepté')
      expect(scores.rows).toHaveLength(outcome.accepted ? 1 : 0)
    })
  })

  Scenario('Un score refusé explique pourquoi au joueur', ({ When, Then }) => {
    When('le joueur termine une partie avec un score de 301', () => finish(301))
    Then('il voit le message "Score refusé : 300 au maximum pour ce jeu."', () => {
      expect(outcome).toEqual({ accepted: false, message: 'Score refusé : 300 au maximum pour ce jeu.' })
    })
  })

  Scenario("Un score envoyé pendant une coupure réseau n'est pas perdu", ({ Given, When, Then, And }) => {
    Given('la connexion est coupée', () => {
      scores.failNext(new GameError('network', 'hors ligne'))
    })
    When('le joueur termine une partie avec un score de 120', () => finish(120))
    Then(
      'il voit le message "Connexion perdue : ton score est gardé sur cet appareil et sera envoyé à ta prochaine partie."',
      () => {
        expect(outcome).toMatchObject({ accepted: false, message: expect.stringContaining('Connexion perdue') })
      },
    )
    And("aucun score n'est encore enregistré", () => {
      expect(scores.rows).toEqual([])
    })
    When("la connexion revient et qu'il termine une partie avec un score de 80", () => finish(80))
    Then('les scores 120 et 80 sont enregistrés', () => {
      expect(scores.rows.map((r) => r.score)).toEqual([120, 80])
    })
  })
})
