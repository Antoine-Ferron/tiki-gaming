import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber'
import { expect } from 'vitest'
import { type BestScores, isUnlocked } from '../domain/progress'

const feature = await loadFeature('src/games/rush-hour/features/deblocage-des-niveaux.feature', { language: 'fr' })

/** « 1, 2 » → niveaux 1 et 2 terminés ; « aucun » → aucun niveau terminé. Le score n'importe pas ici. */
function finishedLevels(list: string): BestScores {
  if (list === 'aucun') return {}
  return Object.fromEntries(list.split(',').map((level) => [Number(level.trim()), 500]))
}

describeFeature(feature, ({ Scenario, ScenarioOutline }) => {
  let best: BestScores
  let open: boolean

  ScenarioOutline('Un niveau est ouvert quand le précédent est terminé', ({ Given, When, Then }, variables) => {
    Given('les niveaux terminés sont : <terminés>', () => {
      best = finishedLevels(variables['terminés'])
    })
    When('le joueur regarde le niveau <niveau>', () => {
      open = isUnlocked(best, Number(variables.niveau))
    })
    Then('le niveau est <état>', () => {
      expect(open).toBe(variables['état'] === 'ouvert')
    })
  })

  Scenario('Terminer un niveau avec 0 point ouvre quand même le suivant', ({ Given, When, Then }) => {
    Given('le niveau {int} est terminé avec {int} point', (_, level: number, score: number) => {
      best = { [level]: score }
    })
    When('le joueur regarde le niveau {int}', (_, level: number) => {
      open = isUnlocked(best, level)
    })
    Then('le niveau est ouvert', () => {
      expect(open).toBe(true)
    })
  })
})
