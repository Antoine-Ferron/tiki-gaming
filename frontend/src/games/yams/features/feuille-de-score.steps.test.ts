import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber'
import { describe, expect } from 'vitest'
import {
  availableCategories,
  type Category,
  CATEGORY_LABELS,
  type Dice,
  fillCategory,
  type Sheet,
  upperBonus,
} from '../logic'

const feature = await loadFeature('src/games/yams/features/feuille-de-score.feature', { language: 'fr' })

/** "3-3-3-6-6" → les cinq dés. */
const parseDice = (lancer: string) => lancer.split('-').map(Number) as unknown as Dice

/** "Petite suite" → 'petiteSuite' : le libellé affiché au joueur, comme dans le .feature. */
function category(label: string): Category {
  const found = (Object.keys(CATEGORY_LABELS) as Category[]).find((c) => CATEGORY_LABELS[c] === label)
  if (!found) throw new Error(`Case inconnue : ${label}`)
  return found
}

// Les étapes d'un scénario s'enchaînent (Étant donné → Quand → Alors) : chacune est un test pour Vitest,
// donc on interdit de les mélanger. Le Contexte remet une feuille vierge avant chaque scénario.
describe('Feuille de score du Yams', { shuffle: false }, () => {
  describeFeature(feature, ({ Background, Scenario, ScenarioOutline }) => {
    let sheet: Sheet
    let dice: Dice
    let refusal: string | undefined
    let bonus: number

    function inscribe(label: string) {
      try {
        sheet = fillCategory(sheet, category(label), dice)
      } catch (err) {
        refusal = (err as Error).message
      }
    }

    Background(({ Given }) => {
      Given('une feuille de score vierge', () => {
        sheet = {}
        refusal = undefined
      })
    })

    Scenario('Un full inscrit dans sa case rapporte 25 points', ({ Given, When, Then, And }) => {
      Given('les dés {string}', (_, lancer: string) => {
        dice = parseDice(lancer)
      })
      When('je les inscris dans la case {string}', (_, label: string) => inscribe(label))
      Then('la case {string} vaut {int} points', (_, label: string, points: number) => {
        expect(sheet[category(label)]).toBe(points)
      })
      And("la case {string} n'est plus disponible", (_, label: string) => {
        expect(availableCategories(sheet)).not.toContain(category(label))
      })
    })

    Scenario('Une case déjà jouée ne peut pas être rejouée', ({ Given, And, When, Then }) => {
      Given('la case {string} vaut déjà {int} points', (_, label: string, points: number) => {
        sheet = { [category(label)]: points }
      })
      And('les dés {string}', (_, lancer: string) => {
        dice = parseDice(lancer)
      })
      When('je les inscris dans la case {string}', (_, label: string) => inscribe(label))
      Then("l'inscription est refusée avec le message {string}", (_, message: string) => {
        expect(refusal).toContain(message)
      })
    })

    ScenarioOutline('Les combinaisons à la frontière des règles', ({ Given, When, Then }, variables) => {
      Given('les dés "<lancer>"', () => {
        dice = parseDice(variables.lancer)
      })
      When('je les inscris dans la case "<case>"', () => inscribe(variables.case))
      Then('la case "<case>" vaut <points> points', () => {
        expect(sheet[category(variables.case)]).toBe(Number(variables.points))
      })
    })

    ScenarioOutline(
      'Le bonus de 35 points se gagne à partir de 63 en section haute',
      ({ Given, When, Then }, variables) => {
        Given('une section haute qui totalise <sous_total> points', () => {
          // 60 points sur les cases 2 à 6, le reste en as : 62 = deux as, 63 = trois as, 64 = quatre as
          sheet = { deux: 6, trois: 9, quatre: 12, cinq: 15, six: 18, as: Number(variables.sous_total) - 60 }
        })
        When('je calcule le bonus', () => {
          bonus = upperBonus(sheet)
        })
        Then('le bonus vaut <bonus> points', () => {
          expect(bonus).toBe(Number(variables.bonus))
        })
      },
    )
  })
})
