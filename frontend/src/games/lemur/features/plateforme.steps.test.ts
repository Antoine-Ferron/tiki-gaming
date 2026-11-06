import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber'
import { expect } from 'vitest'
import { GameError, MESSAGES } from '../../errors'
import { createGameContext } from '../../sdk'
import { FakeScores, fakeDeps } from '../../testing/fakes'
import type { GameContext } from '../../types'
import lemur from '..'
import { finishGame, type Finish } from '../application/finish'
import { PX_PER_METER } from '../domain/game'
import { aGame } from '../testing/builders'

// Étapes liées au domaine et au SDK avec ses fakes (Fake) : pas de Supabase, pas d'interface.
const feature = await loadFeature('src/games/lemur/features/plateforme.feature', { language: 'fr' })

const player = { id: 'p1', username: 'alice' }
const DURATION_MS = 42_000
/** Partie terminée : le maki est monté à 150 m, a ramassé 1 gousse, puis la fossa l'a attrapé. */
const ended = aGame({ peakY: 150 * PX_PER_METER, vanilla: 1, over: 'fossa' })

describeFeature(feature, ({ Scenario }) => {
  let scores: FakeScores
  let ctx: GameContext
  let finish: Finish

  function connectedPlayer() {
    scores = new FakeScores(player)
    ctx = createGameContext(lemur, player, fakeDeps({ scores }))
  }

  Scenario("Le score d'une partie terminée est envoyé une fois", ({ Given, When, Then, And }) => {
    Given('un joueur connecté', connectedPlayer)
    When('il termine une partie avec 150 m et 1 gousse de vanille', async () => {
      finish = await finishGame(ended, ctx, DURATION_MS)
    })
    Then('un seul score de 160 est enregistré pour lui, avec la hauteur, la vanille et la cause', () => {
      expect(finish).toEqual({ score: 160, message: null })
      expect(scores.rows).toEqual([
        {
          gameSlug: 'lemur',
          userId: 'p1',
          username: 'alice',
          score: 160,
          metadata: { heightMeters: 150, vanilla: 1, cause: 'fossa', durationMs: DURATION_MS },
        },
      ])
    })
    And('le classement affiche 160 sur sa ligne', async () => {
      const board = await ctx.getLeaderboard()
      expect(board.find((e) => e.user_id === 'p1')?.best_score).toBe(160)
    })
  })

  Scenario('Un invité joue sans être classé', ({ Given, When, Then, And }) => {
    Given('un invité', () => {
      scores = new FakeScores(player)
      ctx = createGameContext(lemur, null, fakeDeps({ scores }))
    })
    When('il termine une partie avec 150 m et 1 gousse de vanille', async () => {
      finish = await finishGame(ended, ctx, DURATION_MS)
    })
    Then("aucun score n'est enregistré", () => {
      expect(scores.rows).toEqual([])
    })
    And('il voit « Connecte-toi pour apparaître au classement. »', () => {
      expect(finish).toEqual({ score: 160, message: 'Connecte-toi pour apparaître au classement.' })
    })
  })

  Scenario("Une coupure réseau n'empêche pas de rejouer", ({ Given, When, Then, And }) => {
    Given('un joueur connecté et la connexion coupée', () => {
      connectedPlayer()
      scores.failNext(new GameError('network', 'hors ligne'))
    })
    When('il termine une partie avec 150 m et 1 gousse de vanille', async () => {
      finish = await finishGame(ended, ctx, DURATION_MS)
    })
    Then("il voit le message de score gardé sur l'appareil", () => {
      expect(finish).toEqual({ score: 160, message: MESSAGES.queued })
      expect(scores.rows).toEqual([])
    })
    And('la partie suivante se termine normalement, et les deux scores sont enregistrés', async () => {
      const next = await finishGame(aGame({ peakY: 80 * PX_PER_METER, over: 'fall' }), ctx, DURATION_MS)
      expect(next).toEqual({ score: 80, message: null })
      expect(scores.rows.map((r) => r.score)).toEqual([160, 80])
    })
  })
})
