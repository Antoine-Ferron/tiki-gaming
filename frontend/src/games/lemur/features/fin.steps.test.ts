import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber'
import { expect, vi } from 'vitest'
import { advance } from '../domain/advance'
import { type GameOver, type GameState, GRAVITY, MAKI_SIZE, PX_PER_METER, STEP_S } from '../domain/game'
import { aGame } from '../testing/builders'

// Étapes liées directement au domaine du jeu : aucune dépendance au canvas ni à React.
const feature = await loadFeature('src/games/lemur/features/fin.feature', { language: 'fr' })

const NO_INPUT = { left: false, right: false }
/** Vitesse qui s'annule en une image : le maki ne bouge pas pendant l'image. */
const APEX_SPEED = GRAVITY * STEP_S
const MIDDLE = () => 0.5
const m = (meters: number) => meters * PX_PER_METER
const ENDINGS: Record<string, GameOver | null> = {
  aucune: null,
  'le maki est tombé': 'fall',
  'la fossa a attrapé le maki': 'fossa',
}

/** Maki immobile pour une image, fossa loin dessous sauf mention contraire. */
function makiAtApex(feet: number, overrides: Partial<GameState> = {}): GameState {
  return aGame({ maki: { x: 180, y: feet, vy: APEX_SPEED }, peakY: feet, fossaY: feet - m(30), ...overrides })
}

describeFeature(feature, ({ Scenario, ScenarioOutline }) => {
  ScenarioOutline("Le maki tombe sous l'écran", ({ Given, And, When, Then }, variables) => {
    let state: GameState

    Given("le bas de l'écran à 50 m", () => {
      state = aGame({ cameraY: m(50) })
    })
    And('le maki au sommet de son saut, la tête à <tête> m', () => {
      const feet = m(Number(variables['tête'])) - MAKI_SIZE
      state = makiAtApex(feet, { cameraY: state.cameraY, fossaY: state.cameraY - m(40) })
    })
    When("la partie avance d'une image", () => {
      state = advance(state, NO_INPUT, MIDDLE)
    })
    Then('la fin de partie est « <fin> »', () => {
      expect(state.over).toBe(ENDINGS[variables.fin])
    })
  })

  ScenarioOutline('La fossa rattrape le maki', ({ Given, And, When, Then }, variables) => {
    let state: GameState

    Given('le maki au sommet de son saut à 30 m', () => {
      state = makiAtApex(m(30))
    })
    And('la fossa <écart> m sous ses pieds', () => {
      state = { ...state, fossaY: state.maki.y - m(Number(variables['écart'])) }
    })
    When("la partie avance d'une image", () => {
      state = advance(state, NO_INPUT, MIDDLE)
    })
    Then('la fin de partie est « <fin> »', () => {
      expect(state.over).toBe(ENDINGS[variables.fin])
    })
  })

  Scenario('Après la fin, plus rien ne bouge', ({ Given, When, Then, And }) => {
    let ended: GameState
    let state: GameState
    const random = vi.fn(MIDDLE)

    Given('une partie terminée', () => {
      ended = makiAtApex(m(30), { maki: { x: 180, y: m(30), vy: -300 }, over: 'fossa' })
      state = ended
    })
    When('le joueur dirige le maki à droite pendant 10 images', () => {
      for (let i = 0; i < 10; i++) state = advance(state, { left: false, right: true }, random)
    })
    Then("la partie n'a pas changé", () => {
      expect(state).toEqual(ended)
    })
    And("aucun tirage au sort n'a eu lieu", () => {
      expect(random).not.toHaveBeenCalled()
    })
  })
})
