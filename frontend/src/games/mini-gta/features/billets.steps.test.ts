import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber'
import { expect } from 'vitest'
import { newSave, type MiniGtaSave } from '../domain/save'
import { bindSession, useGameStore } from '../state/gameStore'

/** Montant lu par {currency} dans le texte de l'étape (« 500 $ »). */
type Amount = { value: number }

const feature = await loadFeature('src/games/mini-gta/features/billets.feature', { language: 'fr' })

describeFeature(feature, ({ Scenario, AfterEachScenario }) => {
  const persisted: MiniGtaSave[] = []

  AfterEachScenario(() => {
    bindSession(null)
    persisted.length = 0
  })

  /** Joueur en jeu : sa progression part dans une session qui garde chaque sauvegarde. */
  function player(money: number, totalEarned: number) {
    useGameStore.getState().load({ ...newSave(), money, totalEarned })
    bindSession({ persist: async (p) => void persisted.push(p) })
  }

  const pickUp = (amount: number) => useGameStore.getState().addMoney(amount)

  Scenario("Les billets ramassés s'ajoutent à l'argent et au score", ({ Given, When, Then, And }) => {
    Given('un joueur qui a {currency} et qui a gagné {currency}', (_, money: Amount, earned: Amount) =>
      player(money.value, earned.value),
    )
    When('il ramasse des billets pour {currency}', (_, amount: Amount) => pickUp(amount.value))
    Then('il a {currency}', (_, money: Amount) => {
      expect(useGameStore.getState().money).toBe(money.value)
    })
    And('il a gagné {currency} depuis le début de la partie', (_, earned: Amount) => {
      expect(useGameStore.getState().totalEarned).toBe(earned.value)
    })
    And('sa progression est sauvegardée', () => {
      expect(persisted.at(-1)).toMatchObject({
        money: useGameStore.getState().money,
        totalEarned: useGameStore.getState().totalEarned,
      })
    })
  })

  Scenario("Les billets s'ajoutent aux gains déjà faits", ({ Given, When, Then, And }) => {
    Given('un joueur qui a {currency} et qui a gagné {currency}', (_, money: Amount, earned: Amount) =>
      player(money.value, earned.value),
    )
    When('il ramasse des billets pour {currency}', (_, amount: Amount) => pickUp(amount.value))
    Then('il a {currency}', (_, money: Amount) => {
      expect(useGameStore.getState().money).toBe(money.value)
    })
    And('il a gagné {currency} depuis le début de la partie', (_, earned: Amount) => {
      expect(useGameStore.getState().totalEarned).toBe(earned.value)
    })
  })
})
