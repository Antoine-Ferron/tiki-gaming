import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber'
import { expect } from 'vitest'
import { chase } from '../domain/fossa'
import { type GameState, PX_PER_METER } from '../domain/game'
import { aGame } from '../testing/builders'

// Étapes liées directement au domaine du jeu : aucune dépendance au canvas ni à React.
const feature = await loadFeature('src/games/lemur/features/fossa.feature', { language: 'fr' })

const IMAGES_PER_SECOND = 60
const m = (meters: number) => meters * PX_PER_METER

/** Écran au pied du baobab, fossa 10 m sous l'écran : assez près pour ne jamais être rattrapée par la limite des 40 m. */
function gameAt(peak: number): GameState {
  return aGame({ maki: { x: 180, y: peak, vy: 0 }, peakY: peak, fossaY: m(-10) })
}

describeFeature(feature, ({ ScenarioOutline }) => {
  ScenarioOutline("La fossa accélère avec la hauteur, jusqu'à un maximum", ({ Given, When, Then }, variables) => {
    let state: GameState
    let start: number

    Given('le maki monté à <hauteur> m', () => {
      state = gameAt(m(Number(variables.hauteur)))
      start = state.fossaY
    })
    When("le temps avance d'une seconde", () => {
      for (let i = 0; i < IMAGES_PER_SECOND; i++) state = chase(state)
    })
    Then('la fossa est montée de <distance> m', () => {
      expect((state.fossaY - start) / PX_PER_METER).toBeCloseTo(Number(variables.distance), 5)
    })
  })

  ScenarioOutline("La fossa ne reste jamais à plus de 40 m sous l'écran", ({ Given, And, When, Then }, variables) => {
    let state: GameState

    Given("le bas de l'écran à 100 m", () => {
      state = { ...gameAt(0), cameraY: m(100) }
    })
    And("la fossa à <avant> m sous le bas de l'écran", () => {
      state = { ...state, fossaY: state.cameraY - m(Number(variables.avant)) }
    })
    When("le temps avance d'une image", () => {
      state = chase(state)
    })
    Then("la fossa est à <après> m sous le bas de l'écran", () => {
      expect((state.cameraY - state.fossaY) / PX_PER_METER).toBeCloseTo(Number(variables['après']), 2)
    })
  })
})
