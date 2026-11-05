// @vitest-environment jsdom
import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber'
import { expect, vi } from 'vitest'
import { addWeapon, createInventory } from '../systems/weapons'
import { createTestGame, type TestGame } from '../game/testing/harness'

vi.mock('../net/api', () => import('../game/testing/fakeApi'))

const feature = await loadFeature('src/games/mini-gta/features/arrestation.feature', { language: 'fr' })

describeFeature(feature, ({ Background, Scenario, BeforeAllScenarios, AfterAllScenarios }) => {
  let t: TestGame

  // La ville et la physique sont construites une fois : chaque scénario réarme le joueur (Contexte).
  BeforeAllScenarios(async () => {
    t = await createTestGame()
  })
  AfterAllScenarios(() => t.dispose())

  const weapons = () => t.game.player.inventory.weapons.map((w) => w.id)

  function isNear(place: { x: number; z: number }) {
    const p = t.game.player.position
    expect(Math.hypot(p.x - place.x, p.z - place.z)).toBeLessThan(3)
  }

  Background(({ Given, And }) => {
    // Chaque scénario repart d'un joueur neuf : rien ne dépend du scénario précédent.
    Given('une partie en cours', () => {
      t.game.player.inventory = createInventory()
      t.game.player.respawnAt(0, 0.2, 0)
    })
    And("un joueur armé d'un pistolet et d'un fusil d'assaut", () => {
      addWeapon(t.game.player.inventory, 'pistol', 24)
      addWeapon(t.game.player.inventory, 'rifle', 60)
    })
  })

  Scenario('Arrêté, il perd ses armes sauf les poings et sort du commissariat', ({ When, Then, And }) => {
    When('il est arrêté', () => t.game.respawn('busted'))
    Then("il n'a plus que les poings", () => {
      expect(weapons()).toEqual(['fists'])
    })
    And('il réapparaît au commissariat', () => isNear(t.game.city.locations.policeStation))
  })

  Scenario("Mort, il garde ses armes et sort de l'hôpital", ({ When, Then, And }) => {
    When('il meurt', () => t.game.respawn('dead'))
    Then("il a toujours le pistolet et le fusil d'assaut", () => {
      expect(weapons()).toEqual(expect.arrayContaining(['pistol', 'rifle']))
    })
    And("il réapparaît à l'hôpital", () => isNear(t.game.city.locations.hospital))
  })
})
