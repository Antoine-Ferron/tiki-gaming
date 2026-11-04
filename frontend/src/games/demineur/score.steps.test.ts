import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber'
import { expect } from 'vitest'
import { calculateScore } from './logic'

const feature = await loadFeature('src/games/demineur/score.feature', { language: 'fr' })

describeFeature(feature, ({ ScenarioOutline }) => {
  let score: number

  ScenarioOutline('Le score dépend du temps écoulé et du nombre de mines', ({ When, Then }, variables) => {
    When('je calcule le score pour une partie de <mines> mines gagnée en <secondes> secondes', () => {
      score = calculateScore(Number(variables['secondes']), Number(variables['mines']))
    })
    Then('le score est de <score>', () => {
      expect(score).toBe(Number(variables['score']))
    })
  })
})
