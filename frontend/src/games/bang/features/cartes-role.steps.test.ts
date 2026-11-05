// @vitest-environment jsdom
import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber'
import { cleanup, render } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, expect } from 'vitest'
import { RoleCard } from '../cards/RoleCard'
import { ROLES, type Role } from '../cards/roles'

afterEach(cleanup)

const feature = await loadFeature('src/games/bang/features/cartes-role.feature', { language: 'fr' })

describeFeature(feature, ({ Scenario, ScenarioOutline }) => {
  ScenarioOutline('Une carte Rôle visible affiche son nom et son objectif', ({ When, Then, And }, variables) => {
    let shown: { label: string; goal: string }

    When('la carte "<role>" est révélée', () => {
      shown = ROLES[variables.role as Role]
    })
    Then('elle affiche le nom "<nom>"', () => {
      expect(shown.label).toBe(variables.nom)
    })
    And('son objectif contient "<extrait>"', () => {
      expect(shown.goal).toContain(variables.extrait)
    })
  })

  Scenario('Face cachée, les quatre cartes Rôle ont le même dos et ne révèlent rien', ({ When, Then, And }) => {
    const rendered: { html: string; text: string }[] = []

    When('les quatre cartes Rôle sont face cachée', () => {
      for (const role of Object.keys(ROLES) as Role[]) {
        const { container, unmount } = render(createElement(RoleCard, { role, faceUp: false }))
        rendered.push({ html: container.innerHTML, text: container.textContent ?? '' })
        unmount()
      }
    })
    Then('elles montrent toutes le même dos', () => {
      expect(new Set(rendered.map((card) => card.html)).size).toBe(1)
    })
    And("aucune n'affiche de nom ni d'objectif", () => {
      expect(rendered.map((card) => card.text)).toEqual(['', '', '', ''])
    })
  })
})
