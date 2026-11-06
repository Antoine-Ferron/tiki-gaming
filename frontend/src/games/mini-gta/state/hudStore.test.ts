// @vitest-environment jsdom
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { createTestGame, type TestGame } from '../game/testing/harness'
import { addWeapon, createInventory, slotOf } from '../systems/weapons'
import { publishHud, useHudStore } from './hudStore'

vi.mock('../net/api', () => import('../game/testing/fakeApi'))

let t: TestGame

beforeAll(async () => {
  t = await createTestGame()
}, 60_000)

afterAll(() => t?.dispose())

beforeEach(() => {
  // Chaque scénario part à pied, poings en main, un pistolet chargé dans l'inventaire et sans recherche.
  t.reset()
  t.game.player.inventory = createInventory()
  if (!slotOf(t.game.player.inventory, 'pistol')) addWeapon(t.game.player.inventory, 'pistol', 60)
  t.game.combat.select('fists')
})

describe('publication du HUD', () => {
  test('à pied : santé, arme courante et aucune donnée de véhicule', () => {
    publishHud(t.game)

    const h = useHudStore.getState()
    expect(h).toMatchObject({
      ready: true,
      state: 'foot',
      weapon: 'fists',
      weaponLabel: 'Poings',
      inVehicle: false,
      speedKmh: 0,
      altitude: 0,
      vehicleHealth: 1,
      wanted: 0,
    })
    expect(h.health).toBe(t.game.player.actor.health)
    expect(h.owned).toEqual(['fists', 'pistol'])
  })

  test('arme équipée : chargeur et réserve', () => {
    t.game.combat.select('pistol')

    publishHud(t.game)

    expect(useHudStore.getState()).toMatchObject({ weapon: 'pistol', clip: 12, ammo: 48 })
  })

  test('en voiture : vitesse en km/h, nom et état du véhicule', () => {
    const car = [...t.game.vehicles].find((v) => v.persistent && v.spec.id === 'sedan')!
    t.game.player.respawnAt(car.position.x + 3, car.position.y + 0.2, car.position.z)
    t.simulate(0.3)
    t.game.player.tryEnterVehicle()
    t.hold('KeyW', 2)

    publishHud(t.game)

    const h = useHudStore.getState()
    expect(h.inVehicle).toBe(true)
    expect(h.state).toBe('vehicle')
    expect(h.vehicleLabel).toBe(car.spec.label)
    expect(h.speedKmh).toBe(Math.round(Math.abs(car.speed) * 3.6))
    expect(h.speedKmh).toBeGreaterThan(10)
    expect(h.vehicleHealth).toBeGreaterThan(0)
    expect(h.vehicleHealth).toBeLessThanOrEqual(1)
  })

  test('recherché : étoiles publiées', () => {
    const p = t.game.player.position
    t.game.police.wanted.setMinimum(2, p.x, p.z)

    publishHud(t.game)

    expect(useHudStore.getState().wanted).toBe(2)
  })
})
