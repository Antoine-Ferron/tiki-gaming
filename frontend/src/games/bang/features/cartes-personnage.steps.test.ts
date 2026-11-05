import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber'
import { expect } from 'vitest'
import { CHARACTERS, type Character } from '../cards/characters'

const feature = await loadFeature('src/games/bang/features/cartes-personnage.feature', { language: 'fr' })

describeFeature(feature, ({ ScenarioOutline }) => {
  ScenarioOutline(
    'Un personnage affiche son nom, ses points de vie et son pouvoir',
    ({ When, Then, And }, variables) => {
      let shown: { label: string; lifePoints: number; power: string }

      When('la carte "<personnage>" est affichée', () => {
        shown = CHARACTERS[variables.personnage as Character]
      })
      Then('elle montre le nom "<nom>" et <pv> points de vie', () => {
        expect(shown.label).toBe(variables.nom)
        expect(shown.lifePoints).toBe(Number(variables.pv))
      })
      And('son pouvoir mentionne "<extrait>"', () => {
        expect(shown.power).toContain(variables.extrait)
      })
    },
  )
})
