import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber'
import { expect } from 'vitest'
import { createGameContext } from '@/games/sdk'
import { fakeDeps, FakeScores } from '@/games/testing/fakes'
import type { GameContext } from '@/games/types'
import miniGta from '..'
import { newSave } from '../domain/save'
import { createProgressSession } from '../state/session'
import type { ProgressSession } from '../state/gameStore'

/** Montant lu par {currency} dans le texte de l'étape (« 500 $ »). */
type Amount = { value: number }

const feature = await loadFeature('src/games/mini-gta/features/score.feature', { language: 'fr' })

const alice = { id: 'p1', username: 'alice' }

describeFeature(feature, ({ Scenario, ScenarioOutline }) => {
  let scores: FakeScores
  let ctx: GameContext
  let session: ProgressSession

  function join(player: typeof alice | null, lastSent: number | null) {
    scores = new FakeScores(alice)
    ctx = createGameContext(miniGta, player, fakeDeps({ scores }))
    session = createProgressSession(ctx, lastSent, () => {})
  }

  const persist = (earned: number) => session.persist({ ...newSave(), money: earned, totalEarned: earned })

  ScenarioOutline(
    "Le score envoyé est l'argent gagné, seulement s'il bat le dernier envoyé",
    ({ Given, When, Then }, variables) => {
      Given('un joueur connecté dont le dernier score envoyé est de <dernier> $', () =>
        join(alice, Number(variables.dernier)),
      )
      When('sa progression est sauvegardée avec <gagné> $ gagnés', () => persist(Number(variables['gagné'])))
      Then('le classement reçoit <envoyé>', () => {
        const sent = variables['envoyé'] === 'aucun score' ? [] : [Number(variables['envoyé'].split(' ').at(-1))]
        expect(scores.rows.map((r) => r.score)).toEqual(sent)
      })
    },
  )

  Scenario("Un invité garde sa sauvegarde mais n'envoie aucun score", ({ Given, When, Then, And }) => {
    Given('un invité', () => join(null, null))
    When('sa progression est sauvegardée avec {currency} gagnés', (_, earned: Amount) => persist(earned.value))
    Then('sa sauvegarde indique {currency} gagnés', async (_, earned: Amount) => {
      expect(await ctx.loadSave()).toMatchObject({ totalEarned: earned.value })
    })
    And('le classement ne reçoit aucun score', () => {
      expect(scores.rows).toEqual([])
    })
  })
})
