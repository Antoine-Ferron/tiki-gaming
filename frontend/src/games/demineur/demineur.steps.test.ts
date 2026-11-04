import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber'
import { expect } from 'vitest'
import { createGrid, getOutcome, revealCell, toggleFlag, type Grid, type Outcome } from './logic'

const feature = await loadFeature('src/games/demineur/demineur.feature', { language: 'fr' })

const OUTCOME_BY_LABEL: Record<string, Outcome> = {
  perdue: 'lost',
  'en cours': 'playing',
  gagnée: 'won',
}

describeFeature(feature, ({ Background, Scenario, ScenarioOutline }) => {
  let grid: Grid

  Background(({ Given }) => {
    Given('une grille 3×3 avec une seule mine, en haut à gauche', () => {
      // Stub Rng (voir logic.test.ts) : place la mine en (0, 0) de façon déterministe.
      grid = createGrid(3, 3, 1, { next: () => 0 })
    })
  })

  ScenarioOutline('Le résultat de la partie dépend de la case révélée', ({ When, Then }, variables) => {
    When('je révèle la case (<ligne>, <colonne>)', () => {
      revealCell(grid, Number(variables['ligne']), Number(variables['colonne']))
    })
    Then('la partie est <résultat>', () => {
      expect(getOutcome(grid)).toBe(OUTCOME_BY_LABEL[variables['résultat']])
    })
  })

  Scenario('Révéler une case vide déclenche une cascade', ({ When, Then }) => {
    When('je révèle la case (2, 2)', () => {
      revealCell(grid, 2, 2)
    })
    Then('les 8 cases sans mine sont révélées', () => {
      const revealedSafeCells = grid.flat().filter((cell) => cell.revealed && !cell.mine).length
      expect(revealedSafeCells).toBe(8)
    })
  })

  Scenario('Un drapeau empêche la révélation', ({ Given, When, Then, And }) => {
    Given('je pose un drapeau sur la case (0, 0)', () => {
      toggleFlag(grid, 0, 0)
    })
    When('je révèle la case (0, 0)', () => {
      revealCell(grid, 0, 0)
    })
    Then("la case (0, 0) n'est pas révélée", () => {
      expect(grid[0][0].revealed).toBe(false)
    })
    And("la partie n'est pas perdue", () => {
      expect(getOutcome(grid)).not.toBe('lost')
    })
  })

  Scenario('Retirer un drapeau permet à nouveau la révélation', ({ Given, And, When, Then }) => {
    Given('je pose un drapeau sur la case (1, 1)', () => {
      toggleFlag(grid, 1, 1)
    })
    And('je retire le drapeau de la case (1, 1)', () => {
      toggleFlag(grid, 1, 1)
    })
    When('je révèle la case (1, 1)', () => {
      revealCell(grid, 1, 1)
    })
    Then('la case (1, 1) est révélée', () => {
      expect(grid[1][1].revealed).toBe(true)
    })
  })

  Scenario('Révéler une case déjà révélée ne fait rien', ({ Given, When, Then }) => {
    Given('je révèle la case (1, 1)', () => {
      revealCell(grid, 1, 1)
    })
    When('je révèle à nouveau la case (1, 1)', () => {
      revealCell(grid, 1, 1)
    })
    Then("la partie n'est pas perdue", () => {
      expect(getOutcome(grid)).not.toBe('lost')
    })
  })
})
