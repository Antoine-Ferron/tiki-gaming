import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber'
import { expect } from 'vitest'
import { growBranches, type Random } from '../domain/branches'
import {
  type Branch,
  BRANCH_HEIGHT,
  BRANCH_WIDTH,
  type GameState,
  GRAVITY,
  JUMP_SPEED,
  PX_PER_METER,
  VIEW_HEIGHT,
  WORLD_WIDTH,
} from '../domain/game'

// Étapes liées directement au domaine du jeu, avec un tirage au sort fixé (Stub) : résultats reproductibles.
const feature = await loadFeature('src/games/lemur/features/branches.feature', { language: 'fr' })

/** Hauteur d'un saut normal : v² / 2g. */
const JUMP_HEIGHT = JUMP_SPEED ** 2 / (2 * GRAVITY)
const MIDDLE: Random = () => 0.5
const m = (meters: number) => meters * PX_PER_METER
const topOf = (b: Branch) => b.y + BRANCH_HEIGHT

function screenAt(bottom: number): GameState {
  return { maki: { x: 180, y: bottom + 100, vy: 0 }, branches: [], cameraY: bottom, peakY: 0, fossaY: 0 }
}

describeFeature(feature, ({ ScenarioOutline }) => {
  ScenarioOutline("Des branches attendent toujours au-dessus de l'écran", ({ Given, When, Then }, variables) => {
    let state: GameState

    Given("le bas de l'écran à <bas> m", () => {
      state = screenAt(m(Number(variables.bas)))
    })
    When('les branches poussent', () => {
      state = growBranches(state, MIDDLE)
    })
    Then('la plus haute branche est au moins à <haut> m', () => {
      const highest = Math.max(-Infinity, ...state.branches.map((b) => b.y))
      expect(highest).toBeGreaterThanOrEqual(m(Number(variables.haut)))
    })
  })

  ScenarioOutline("Les branches passées sous l'écran disparaissent", ({ Given, And, When, Then }, variables) => {
    let state: GameState
    let branch: Branch

    Given("le bas de l'écran à 20 m", () => {
      state = screenAt(m(20))
    })
    And('une branche dont le dessus est à <dessus> m', () => {
      branch = { x: 100, y: m(Number(variables.dessus)) - BRANCH_HEIGHT }
      state = { ...state, branches: [branch] }
    })
    When('les branches poussent', () => {
      state = growBranches(state, MIDDLE)
    })
    Then('cette branche <résultat>', () => {
      const kept = state.branches.some((b) => b.x === branch.x && b.y === branch.y)
      expect(kept).toBe(variables['résultat'] === 'est gardée')
    })
  })

  ScenarioOutline('Une branche est toujours à portée de saut', ({ Given, When, Then, And }, variables) => {
    let random: Random
    const grown = new Map<number, Branch>()

    Given('un tirage au sort qui donne toujours <tirage>', () => {
      const value = Number(variables.tirage)
      random = () => value
    })
    When("les branches poussent jusqu'à 3000 m", () => {
      // L'écran monte d'un écran à la fois ; on garde trace de toutes les branches apparues.
      let state = screenAt(0)
      for (let i = 0; i < 100 && Math.max(0, ...grown.keys()) < m(3000); i++) {
        state = growBranches(state, random)
        state.branches.forEach((b) => grown.set(b.y, b))
        state = { ...state, cameraY: state.cameraY + VIEW_HEIGHT }
      }
    })
    Then("des branches montent jusqu'à au moins 3000 m", () => {
      expect(Math.max(0, ...grown.keys())).toBeGreaterThanOrEqual(m(3000))
    })
    And("l'écart entre deux branches successives reste inférieur à la hauteur d'un saut normal", () => {
      const tops = [...grown.values()].map(topOf).sort((a, b) => a - b)
      tops.slice(1).forEach((top, i) => expect(top - tops[i]).toBeLessThan(JUMP_HEIGHT))
    })
    And("toutes les branches sont entièrement dans l'écran", () => {
      for (const b of grown.values()) {
        expect(b.x).toBeGreaterThanOrEqual(0)
        expect(b.x + BRANCH_WIDTH).toBeLessThanOrEqual(WORLD_WIDTH)
      }
    })
  })
})
