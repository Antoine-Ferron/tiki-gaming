import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber'
import { expect } from 'vitest'
import { type GameState, GRAVITY, PX_PER_METER, step, STEP_S } from '../domain/game'

// Étapes liées directement au domaine du jeu : aucune dépendance au canvas ni à React.
const feature = await loadFeature('src/games/lemur/features/camera.feature', { language: 'fr' })

const NO_INPUT = { left: false, right: false }
/** Vitesse qui s'annule en une image : le maki est au sommet de son saut et ne bouge pas pendant l'image. */
const APEX_SPEED = GRAVITY * STEP_S

describeFeature(feature, ({ Scenario, ScenarioOutline }) => {
  let state: GameState

  function cameraAt(meters: number) {
    state = { maki: { x: 180, y: 0, vy: 0 }, branches: [], cameraY: meters * PX_PER_METER, peakY: 0, fossaY: 0 }
  }
  function makiAtApex(meters: number) {
    state = { ...state, maki: { ...state.maki, y: meters * PX_PER_METER, vy: APEX_SPEED } }
  }
  function cameraShouldBeAt(meters: number) {
    expect(state.cameraY).toBeCloseTo(meters * PX_PER_METER)
  }

  ScenarioOutline(
    "La caméra suit le maki qui dépasse le milieu de l'écran",
    ({ Given, And, When, Then }, variables) => {
      Given("le bas de l'écran à 0 m", () => cameraAt(0))
      And('le maki au sommet de son saut à <hauteur> m', () => makiAtApex(Number(variables.hauteur)))
      When("le temps avance d'une image", () => {
        state = step(state, NO_INPUT)
      })
      Then("le bas de l'écran est à <bas> m", () => cameraShouldBeAt(Number(variables.bas)))
    },
  )

  Scenario('La caméra ne redescend jamais', ({ Given, And, When, Then }) => {
    Given("le bas de l'écran à 68 m", () => cameraAt(68))
    And('le maki au sommet de son saut à 90 m', () => makiAtApex(90))
    When("le temps avance d'une image", () => {
      state = step(state, NO_INPUT)
    })
    Then("le bas de l'écran est à 68 m", () => cameraShouldBeAt(68))
  })
})
