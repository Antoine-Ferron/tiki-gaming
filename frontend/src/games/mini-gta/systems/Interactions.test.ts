// @vitest-environment jsdom
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { createTestGame, type TestGame } from '../game/testing/harness'
import { useUiStore } from '../state/uiStore'
import type { Vehicle } from '../entities/Vehicle'

vi.mock('../net/api', () => import('../game/testing/fakeApi'))

let t: TestGame
let game: TestGame['game']
let notes: string[] = []

const teleport = (x: number, y: number, z: number) => {
  game.player.respawnAt(x, y, z)
  t.simulate(0.1)
}
const vehicle = (id: string) => [...game.vehicles].find((v) => v.persistent && v.spec.id === id)!
const drive = (v: Vehicle) => {
  teleport(v.position.x + 2.5, v.position.y + 0.2, v.position.z)
  game.player.tryEnterVehicle()
  t.simulate(0.1)
}

beforeAll(async () => {
  t = await createTestGame()
  game = t.game
  game.events.on('notify', (n) => notes.push(n.text))
}, 60_000)

afterAll(() => t?.dispose())

beforeEach(() => {
  if (game.player.vehicle) game.player.exitVehicle(true)
  game.ui.blocking = false
  useUiStore.setState({ menu: null })
  const s = game.city.locations.spawn
  teleport(s.x, s.y, s.z)
  notes = []
})

describe('invites et touche E', () => {
  test('au comptoir de l’armurerie, E ouvre la boutique', () => {
    const L = game.city.locations.gunshopCounter
    teleport(L.x, L.y, L.z)

    expect(game.interactions.prompt).toMatch(/armurerie/)
    t.press('KeyE')
    t.simulate(0.05)

    expect(useUiStore.getState().menu).toBe('shop')
  })

  test('dans la planque, E sauvegarde la partie', async () => {
    const L = game.city.locations.safehouseInside
    teleport(L.x, L.y, L.z)

    expect(game.interactions.prompt).toMatch(/sauvegarder la partie/)
    t.press('KeyE')
    t.simulate(0.05)

    await vi.waitFor(() => expect(notes).toContain('Partie sauvegardée'))
  })

  test.each([
    ['une voiture garée', false, /entrer dans berline/],
    ['une voiture avec un conducteur', true, /voler berline/],
  ])('près d’%s, F propose d’y monter', (_, withDriver, expected) => {
    const car = vehicle('sedan')
    const driver = car.driver
    if (withDriver) car.driver = game.player.actor
    teleport(car.position.x + 2.5, car.position.y + 0.2, car.position.z)

    const prompt = game.interactions.prompt
    car.driver = driver

    expect(prompt).toMatch(expected)
  })

  test.each([
    ['hélicoptère', 'heli', /monter · Ctrl descendre/],
    ['avion', 'plane', /gaz/],
  ])('aux commandes d’un %s, l’aide de pilotage s’affiche', (_, id, expected) => {
    drive(vehicle(id))

    expect(game.interactions.prompt).toMatch(expected)
  })

  test('en voiture, aucune invite', () => {
    drive(vehicle('sedan'))

    expect(game.player.state).toBe('vehicle')
    expect(game.interactions.prompt).toBeNull()
  })

  test('menu ouvert : aucune invite ni action', () => {
    const L = game.city.locations.gunshopCounter
    teleport(L.x, L.y, L.z)
    game.ui.blocking = true

    game.interactions.update()

    expect(game.interactions.prompt).toBeNull()
  })

  test('loin de tout : aucune invite', () => {
    const s = game.city.locations.spawn
    teleport(s.x + 300, s.y, s.z + 300)

    expect(game.interactions.prompt).toBeNull()
  })
})
