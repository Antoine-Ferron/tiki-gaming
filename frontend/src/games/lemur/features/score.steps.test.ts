import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber'
import { expect } from 'vitest'
import { advance } from '../domain/advance'
import { type GameState, GRAVITY, PX_PER_METER, STEP_S } from '../domain/game'
import { score } from '../domain/score'
import { aGame } from '../testing/builders'

// Étapes liées directement au domaine du jeu : aucune dépendance au canvas ni à React.
const feature = await loadFeature('src/games/lemur/features/score.feature', { language: 'fr' })

const NO_INPUT = { left: false, right: false }
/** Vitesse qui s'annule en une image : le maki ne bouge pas pendant l'image. */
const APEX_SPEED = GRAVITY * STEP_S
const MIDDLE = () => 0.5
const m = (meters: number) => meters * PX_PER_METER

describeFeature(feature, ({ ScenarioOutline }) => {
  ScenarioOutline('Le score compte la hauteur maximale et la vanille', ({ Given, And, Then }, variables) => {
    let state: GameState

    Given('le maki monté au plus haut à <hauteur> m', () => {
      state = aGame({ peakY: m(Number(variables.hauteur)) })
    })
    And('<gousses> gousses de vanille ramassées', () => {
      state = { ...state, vanilla: Number(variables.gousses) }
    })
    Then('le score est de <score>', () => {
      expect(score(state)).toBe(Number(variables.score))
    })
  })

  ScenarioOutline(
    'La hauteur maximale suit le maki sans jamais redescendre',
    ({ Given, And, When, Then }, variables) => {
      let state: GameState

      Given('le maki monté au plus haut à <avant> m', () => {
        state = aGame({ peakY: m(Number(variables.avant)) })
      })
      And('le maki au sommet de son saut à <maki> m', () => {
        const y = m(Number(variables.maki))
        state = { ...state, maki: { x: 180, y, vy: APEX_SPEED }, fossaY: y - m(30) }
      })
      When("la partie avance d'une image", () => {
        state = advance(state, NO_INPUT, MIDDLE)
      })
      Then('le maki est monté au plus haut à <après> m', () => {
        expect(state.peakY).toBeCloseTo(m(Number(variables['après'])))
      })
    },
  )
})
