// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest'
import { PerspectiveCamera, Scene, type WebGLRenderer } from 'three'
import { TERRAIN_CELLS } from '../world/constants'
import missions from './fixtures/missions.json'
import worldAroundSpawn from './fixtures/world-spawn.json'
import weapons from '../systems/fixtures/weapons.json'

/**
 * Simulation complète sans rendu : une vraie portion de la ville (extraite de GET /world autour du point
 * de départ, terrain plat), la vraie physique et tous les systèmes. Seuls le réseau, le WebGL et le canvas
 * 2D sont remplacés par des doublures.
 */

function flatTerrain(): string {
  const bytes = new Uint8Array((TERRAIN_CELLS + 1) ** 2 * 4)
  let bin = ''
  for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode(...bytes.subarray(i, i + 8192))
  return btoa(bin)
}

vi.mock('../net/api', () => ({
  api: {
    world: async () => ({ ...worldAroundSpawn, terrain: { n: TERRAIN_CELLS, heights: flatTerrain() } }),
    missions: async () => missions,
    weapons: async () => weapons,
    route: async () => [],
    completeMission: async () => {
      throw new Error('hors ligne')
    },
    purchase: async () => {
      throw new Error('hors ligne')
    },
    respawn: async (progress: unknown) => ({ fee: 0, progress }),
  },
}))

/** Objet qui accepte n'importe quel accès ou appel : remplace le renderer WebGL et le contexte 2D. */
function anything(): unknown {
  const target = function () {}
  const proxy: unknown = new Proxy(target, {
    get: (_, key) => {
      if (key === Symbol.toPrimitive) return () => 0
      if (key === 'data') return new Uint8ClampedArray(4 * 1024 * 1024)
      if (key === 'width' || key === 'height') return 1
      return proxy
    },
    set: () => true,
    apply: () => proxy,
    construct: () => proxy as object,
  })
  return proxy
}

// Les textures dessinées au canvas sont créées dès l'import des modules du rendu.
HTMLCanvasElement.prototype.getContext = (() => anything()) as unknown as HTMLCanvasElement['getContext']
const { Game } = await import('./Game')
const { input } = await import('../core/input')
type GameT = InstanceType<typeof Game>

let game: GameT
const simulate = (seconds: number) => {
  for (let i = 0; i < Math.round(seconds * 60); i++) game.update(1 / 60)
}

let detachInput: () => void

beforeAll(async () => {
  detachInput = input.attach(document.createElement('canvas'))
  game = new Game(new Scene(), new PerspectiveCamera(), anything() as WebGLRenderer)
  await game.init(() => {})
}, 60_000)

afterAll(() => {
  detachInput()
  game?.dispose()
})

describe('simulation de MiniGTA', () => {
  test('le joueur apparaît au point de départ, à pied, avec des véhicules autour', () => {
    const spawn = worldAroundSpawn.locations.spawn

    expect(game.player.position.x).toBeCloseTo(spawn.x, 0)
    expect(game.player.position.z).toBeCloseTo(spawn.z, 0)
    expect(game.player.state).toBe('foot')
    expect(game.vehicles.size).toBeGreaterThan(0)
  })

  test('le joueur reste au sol après quelques secondes', () => {
    simulate(2)

    expect(game.player.position.y).toBeGreaterThan(-0.2)
    expect(game.player.position.y).toBeLessThan(0.5)
  })

  test('le trafic et les piétons vivent', () => {
    const before = new Map([...game.vehicles].map((v) => [v, v.position.clone()]))

    simulate(5)

    const moved = [...before].filter(([v, p]) => game.vehicles.has(v) && v.position.distanceTo(p) > 2)
    expect(moved.length).toBeGreaterThan(0)
    expect(game.peds.count).toBeGreaterThan(0)
  })

  test('le joueur monte dans la voiture de départ et roule vers l’avant', () => {
    const car = [...game.vehicles].find((v) => v.persistent && v.spec.id === 'sedan')!
    game.player.respawnAt(car.position.x + 3, car.position.y + 0.2, car.position.z)
    simulate(0.5)

    game.player.tryEnterVehicle()
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }))
    simulate(3)
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }))

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

    simulate(12)

    expect(game.police.wanted.stars).toBeGreaterThanOrEqual(1)
    const cars = [...game.vehicles].filter((v) => v.tags.has('police') && !v.destroyed)
    expect(cars.length + [...game.police.actors()].length).toBeGreaterThan(0)
  })

  test('une explosion proche blesse le joueur', () => {
    const health = game.player.actor.health
    const p = game.player.position

    game.combat.explosion(p.x + 2, p.y + 0.5, p.z + 2, 8, 50, null)
    simulate(0.5)

    expect(game.player.actor.health).toBeLessThan(health)
  })
})
