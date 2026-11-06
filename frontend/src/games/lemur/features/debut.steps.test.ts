import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber'
import { expect } from 'vitest'
import { advance } from '../domain/advance'
import { BRANCH_HEIGHT, BRANCH_WIDTH, type GameState, JUMP_SPEED, PX_PER_METER } from '../domain/game'
import { score } from '../domain/score'
import { createGame } from '../domain/start'

// Étapes liées directement au domaine du jeu, avec un tirage au sort fixé (Stub).
const feature = await loadFeature('src/games/lemur/features/debut.feature', { language: 'fr' })

const NO_INPUT = { left: false, right: false }
/** Tirage qui écarte toutes les autres branches du maki (x = 0 à 70 px) : seule sa branche de départ compte. */
const LEFT_EDGE = () => 0
const m = (meters: number) => meters * PX_PER_METER

describeFeature(feature, ({ Scenario }) => {
  Scenario('Une partie commence au pied du baobab', ({ When, Then, And }) => {
    let state: GameState

    When('une nouvelle partie commence', () => {
      state = createGame(LEFT_EDGE)
    })
    Then('le maki est à 0 m, sur une branche centrée sous lui', () => {
      expect(state.maki).toEqual({ x: 180, y: 0, vy: 0 })
      expect(state.branches).toContainEqual({ x: 180 - BRANCH_WIDTH / 2, y: -BRANCH_HEIGHT })
    })
    And("le bas de l'écran est à 0 m", () => {
      expect(state.cameraY).toBe(0)
    })
    And("la fossa attend 40 m sous le bas de l'écran", () => {
      expect(state.fossaY).toBe(m(-40))
    })
    And("des branches attendent jusqu'à au moins 128 m", () => {
      expect(Math.max(...state.branches.map((b) => b.y))).toBeGreaterThanOrEqual(m(128))
    })
    And('le score est de 0', () => {
      expect(score(state)).toBe(0)
      expect(state.over).toBeNull()
    })
  })

  Scenario('Le maki rebondit tout de suite sur sa première branche', ({ Given, When, Then }) => {
    let state: GameState

    Given('une nouvelle partie', () => {
      state = createGame(LEFT_EDGE)
    })
    When('la partie avance de 2 images', () => {
      state = advance(advance(state, NO_INPUT, LEFT_EDGE), NO_INPUT, LEFT_EDGE)
    })
    Then("le maki repart vers le haut à la vitesse d'un saut normal", () => {
      expect(state.maki.vy).toBeGreaterThan(JUMP_SPEED - 100)
      expect(state.over).toBeNull()
    })
  })
})
