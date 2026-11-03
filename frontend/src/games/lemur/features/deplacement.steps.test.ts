import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber'
import { expect } from 'vitest'
import { BRANCH_HEIGHT, BRANCH_WIDTH, type GameState, type Input, JUMP_SPEED, step } from '../domain/game'

// Étapes liées directement au domaine du jeu : aucune dépendance au canvas ni à React.
const feature = await loadFeature('src/games/lemur/features/deplacement.feature', { language: 'fr' })

const NO_INPUT: Input = { left: false, right: false }
const DIRECTIONS: Record<string, Input> = {
  'nulle part': NO_INPUT,
  'à gauche': { left: true, right: false },
  'à droite': { left: false, right: true },
}

/** Une branche centrée sous x = 180, dessus à y = 100. */
const BRANCH = { x: 180 - BRANCH_WIDTH / 2, y: 100 - BRANCH_HEIGHT }
const BRANCH_TOP = 100

function run(state: GameState, images: number, input: Input = NO_INPUT) {
  let current = state
  for (let i = 0; i < images; i++) current = step(current, input)
  return current
}

describeFeature(feature, ({ Scenario, ScenarioOutline }) => {
  Scenario('Le maki rebondit sur une branche touchée en descendant', ({ Given, And, When, Then }) => {
    let state: GameState

    Given('une branche normale sous le maki', () => {
      state = { maki: { x: 180, y: BRANCH_TOP + 2, vy: 0 }, branches: [BRANCH] }
    })
    And('le maki qui descend vers elle', () => {
      state = { ...state, maki: { ...state.maki, vy: -200 } }
    })
    When("le temps avance d'une image", () => {
      state = run(state, 1)
    })
    Then("le maki repart vers le haut à la vitesse d'un saut normal", () => {
      expect(state.maki.vy).toBe(JUMP_SPEED)
      expect(state.maki.y).toBe(BRANCH_TOP)
    })
  })

  Scenario('Le maki traverse une branche en montant', ({ Given, And, When, Then }) => {
    let state: GameState
    let bounced = false

    Given('une branche normale juste au-dessus du maki', () => {
      state = { maki: { x: 180, y: BRANCH_TOP - 20, vy: 0 }, branches: [BRANCH] }
    })
    And('le maki qui monte', () => {
      state = { ...state, maki: { ...state.maki, vy: 600 } }
    })
    When('le temps avance de 10 images', () => {
      for (let i = 0; i < 10; i++) {
        const before = state.maki.vy
        state = run(state, 1)
        if (state.maki.vy > before) bounced = true
      }
    })
    Then('le maki est au-dessus de la branche', () => {
      expect(state.maki.y).toBeGreaterThan(BRANCH_TOP)
    })
    And("il n'a pas rebondi", () => {
      expect(bounced).toBe(false)
    })
  })

  ScenarioOutline('Le joueur dirige le maki, et les bords sont reliés', ({ Given, When, Then }, variables) => {
    let state: GameState

    Given('le maki à <départ> px du bord gauche', () => {
      // Assez haut pour ne toucher aucune branche, à l'apogée d'un saut.
      state = { maki: { x: Number(variables['départ']), y: 500, vy: 0 }, branches: [] }
    })
    When('le joueur le dirige <direction> pendant une image', () => {
      state = run(state, 1, DIRECTIONS[variables.direction])
    })
    Then('le maki est à <arrivée> px du bord gauche', () => {
      expect(state.maki.x).toBeCloseTo(Number(variables['arrivée']))
    })
  })
})
