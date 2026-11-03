import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber'
import { expect } from 'vitest'
import { fireAndSubmitIfOver, type PlacedShip, type Ship, type ShotResult } from './logic'

// Étapes liées directement au domaine du jeu (logic.ts) : aucune dépendance à l'interface.
const feature = await loadFeature('src/games/bataille-navale/bataille-navale.feature', { language: 'fr' })

const torpilleur: Ship = { name: 'Torpilleur', size: 2 }

function parseCoord(text: string): { row: number; col: number } {
  const match = /\((\d+),(\d+)\)/.exec(text)
  if (!match) throw new Error(`Case invalide : ${text}`)
  return { row: Number(match[1]), col: Number(match[2]) }
}

describeFeature(feature, ({ Background, Scenario }) => {
  let fleet: PlacedShip[]
  let shots: Set<string>
  // Chaque étape Gherkin tourne comme son propre test ; vi.fn() ne convient pas ici (ses appels
  // sont effacés entre deux tests), d'où un compteur en mémoire simple, qui persiste entre les
  // étapes d'un même scénario.
  let submittedScores: Array<{ score: number; metadata: { shots: number; hits: number } }>
  let outcome: { result: ShotResult; sunk?: Ship; gameOver: boolean }

  async function fireAt(coord: string) {
    outcome = await fireAndSubmitIfOver(fleet, shots, parseCoord(coord), async (score, metadata) => {
      submittedScores.push({ score, metadata })
      return true
    })
  }

  Background(({ Given }) => {
    Given("une flotte adverse composée d'un unique Torpilleur occupant les cases (0,0) et (0,1)", () => {
      fleet = [
        {
          ship: torpilleur,
          coords: [
            { row: 0, col: 0 },
            { row: 0, col: 1 },
          ],
        },
      ]
      shots = new Set()
      submittedScores = []
    })
  })

  Scenario("Un tir dans l'eau ne coule aucun navire et la partie continue", ({ When, Then, And }) => {
    When('je tire sur la case (5,5)', () => fireAt('(5,5)'))
    Then("le tir est à l'eau", () => expect(outcome.result).toBe('miss'))
    And('la partie continue', () => expect(outcome.gameOver).toBe(false))
  })

  Scenario(
    "Toucher une des cases d'un navire le touche sans le couler s'il reste une case intacte",
    ({ When, Then, And }) => {
      When('je tire sur la case (0,0)', () => fireAt('(0,0)'))
      Then('le tir touche le Torpilleur', () => expect(outcome.result).toBe('hit'))
      And("le Torpilleur n'est pas encore coulé", () => expect(outcome.sunk).toBeUndefined())
      And('la partie continue', () => expect(outcome.gameOver).toBe(false))
    },
  )

  Scenario("Toucher toutes les cases d'un navire le coule", ({ When, And, Then }) => {
    When('je tire sur la case (0,0)', () => fireAt('(0,0)'))
    And('je tire sur la case (0,1)', () => fireAt('(0,1)'))
    Then('le Torpilleur est coulé', () => expect(outcome.sunk).toEqual(torpilleur))
  })

  Scenario(
    'Couler le dernier navire de la flotte adverse termine la partie et soumet le score',
    ({ When, And, Then }) => {
      When('je tire sur la case (0,0)', () => fireAt('(0,0)'))
      And('je tire sur la case (0,1)', () => fireAt('(0,1)'))
      Then('la partie est terminée', () => expect(outcome.gameOver).toBe(true))
      And('un score est soumis une seule fois', () => expect(submittedScores).toHaveLength(1))
    },
  )

  Scenario("Tirer deux fois sur la même case ne compte qu'une fois", ({ When, And, Then }) => {
    When('je tire sur la case (0,0)', () => fireAt('(0,0)'))
    And('je tire de nouveau sur la case (0,0)', () => fireAt('(0,0)'))
    Then('le second tir est compté comme répété', () => expect(outcome.result).toBe('repeat'))
    And('un seul tir a été enregistré contre la flotte adverse', () => expect(shots.size).toBe(1))
  })
})
