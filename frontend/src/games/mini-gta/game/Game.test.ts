// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest'
import worldAroundSpawn from './fixtures/world-spawn.json'
import { createTestGame, type TestGame } from './testing/harness'

/**
 * Simulation complète sans rendu : une vraie portion de la ville (extraite de GET /world autour du point
 * de départ, terrain plat), la vraie physique et tous les systèmes. Seuls le réseau, le WebGL et le canvas
 * 2D sont remplacés par des doublures.
 */
vi.mock('../net/api', () => import('./testing/fakeApi'))

// Simulations longues : la suite complète tourne en parallèle.
vi.setConfig({ testTimeout: 60_000 })

let t: TestGame
let game: TestGame['game']
const simulate = (seconds: number) => t.simulate(seconds)

beforeAll(async () => {
  t = await createTestGame({ traffic: 6, pedestrians: 6, meshes: true })
  game = t.game
}, 60_000)

afterAll(() => t?.dispose())

describe('simulation de MiniGTA', () => {
  test('le joueur apparaît au point de départ, à pied, avec des véhicules autour', () => {
    const spawn = worldAroundSpawn.locations.spawn

    expect(game.player.position.x).toBeCloseTo(spawn.x, 0)
    expect(game.player.position.z).toBeCloseTo(spawn.z, 0)
    expect(game.player.state).toBe('foot')
    expect(game.vehicles.size).toBeGreaterThan(0)
  })

  test('le joueur reste au sol après quelques secondes', () => {
    simulate(1)

    expect(game.player.position.y).toBeGreaterThan(-0.2)
    expect(game.player.position.y).toBeLessThan(0.5)
  })

  test('le trafic et les piétons vivent', () => {
    const before = new Map([...game.vehicles].map((v) => [v, v.position.clone()]))

    t.until(() => [...before].some(([v, p]) => game.vehicles.has(v) && v.position.distanceTo(p) > 2), 5)

    const moved = [...before].filter(([v, p]) => game.vehicles.has(v) && v.position.distanceTo(p) > 2)
    expect(moved.length).toBeGreaterThan(0)
    expect(game.peds.count).toBeGreaterThan(0)
  })

  test('le joueur monte dans la voiture de départ et roule vers l’avant', () => {
    const car = [...game.vehicles].find((v) => v.persistent && v.spec.id === 'sedan')!
    game.player.respawnAt(car.position.x + 3, car.position.y + 0.2, car.position.z)
    simulate(0.5)

    game.player.tryEnterVehicle()
    t.key('KeyW', true)
    simulate(3)
    t.key('KeyW', false)

    expect(game.player.state).toBe('vehicle')
    expect(game.player.vehicle?.speed).toBeGreaterThan(5)
  })

  test('le joueur sort du véhicule', () => {
    game.player.exitVehicle(true)
    simulate(1)

    expect(game.player.state).toBe('foot')
  })

  test('la police poursuit un joueur recherché', () => {
    const p = game.player.position
    game.police.wanted.setMinimum(3, p.x, p.z)

    const cars = () => [...game.vehicles].filter((v) => v.tags.has('police') && !v.destroyed)
    t.until(() => cars().length + [...game.police.actors()].length > 0, 12)

    expect(game.police.wanted.stars).toBeGreaterThanOrEqual(1)
    expect(cars().length + [...game.police.actors()].length).toBeGreaterThan(0)
  })

  test('une explosion proche blesse le joueur', () => {
    const health = game.player.actor.health
    const p = game.player.position

    game.combat.explosion(p.x + 2, p.y + 0.5, p.z + 2, 8, 50, null)
    simulate(0.5)

    expect(game.player.actor.health).toBeLessThan(health)
  })
})
