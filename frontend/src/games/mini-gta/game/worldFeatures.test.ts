// @vitest-environment jsdom
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import type { Building } from '../world/city'
import { Groups } from '../physics/physics'
import { createTestGame, type TestGame } from './testing/harness'

vi.mock('../net/api', () => import('./testing/fakeApi'))
vi.setConfig({ testTimeout: 60_000 })

/** Tremplins et rez-de-chaussée accessibles, dans une partie simulée sur la portion de ville du fixture. */
let t: TestGame
let game: TestGame['game']

beforeAll(async () => {
  t = await createTestGame()
  game = t.game
}, 60_000)

afterAll(() => t?.dispose())

beforeEach(() => {
  // Joueur à pied au départ, et plus aucune voiture laissée par un autre scénario (devant une porte, au pied
  // d'un tremplin) : seuls les véhicules de départ restent.
  t.reset()
  for (const v of [...game.vehicles]) if (!v.persistent) game.removeVehicle(v)
})

const SIDE_OUT: [number, number][] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
]

describe('tremplins', () => {
  test('la ville du fixture en contient, de taille crédible', () => {
    expect(game.city.ramps.length).toBeGreaterThan(0)
    for (const r of game.city.ramps) {
      expect(r.height).toBeGreaterThan(0.5)
      expect(r.length).toBeGreaterThan(r.height * 4)
    }
  })

  test('une voiture lancée à 80 km/h décolle et retombe sans exploser', () => {
    const r = game.city.ramps.reduce((a, b) => (b.height > a.height ? b : a))
    const fx = Math.sin(r.rot)
    const fz = Math.cos(r.rot)
    const back = r.length / 2 + 6
    const car = game.spawnVehicle('sedan', r.x - fx * back, r.y + 0.3, r.z - fz * back, r.rot, 'dynamic')
    car.driver = game.debugSpawnActor(r.x, r.z, 0, 5)
    t.simulate(0.2)
    car.body.setLinvel({ x: fx * (80 / 3.6), y: 0, z: fz * (80 / 3.6) }, true)
    const wheels = (car as unknown as { controller: { numWheels(): number; wheelIsInContact(i: number): boolean } })
      .controller
    let peak = -Infinity
    let airborne = 0
    for (let i = 0; i < 240; i++) {
      car.control.throttle = 0.5
      car.control.steer = 0
      t.simulate(1 / 60)
      peak = Math.max(peak, car.position.y)
      const flying = [...Array(wheels.numWheels()).keys()].every((k) => !wheels.wheelIsInContact(k))
      if (flying && car.position.y > r.y + 0.3) airborne++
    }

    expect(peak).toBeGreaterThan(r.y + r.height - 0.3)
    // Au moins un quart de seconde les quatre roues en l'air.
    expect(airborne).toBeGreaterThan(15)
    expect(car.destroyed).toBe(false)
    expect(car.position.y).toBeLessThan(r.y + 1)
  })
})

describe('bâtiments où l’on peut entrer', () => {
  /** Bâtiment ouvert assez profond pour avoir une cloison, porte face à la rue. */
  function openBuilding(): Building {
    const s = game.city.locations.spawn
    const open = game.city.buildings.filter((b) => {
      if (b.special || b.hollow?.floorHeight === undefined) return false
      const depth = b.hollow.doorSide % 2 === 0 ? b.hd * 2 : b.hw * 2
      const span = b.hollow.doorSide % 2 === 0 ? b.hw * 2 : b.hd * 2
      return depth > 10 && span > 7
    })
    return open.sort((a, b) => Math.hypot(a.x - s.x, a.z - s.z) - Math.hypot(b.x - s.x, b.z - s.z))[0]
  }

  test('le fixture contient des maisons et immeubles ouverts', () => {
    const open = game.city.buildings.filter((b) => !b.special && b.hollow?.floorHeight !== undefined)
    expect(open.length).toBeGreaterThan(10)
  })

  test('le joueur entre par la porte et se retrouve sous un plafond', () => {
    const b = openBuilding()
    const [ox, oz] = SIDE_OUT[b.hollow!.doorSide]
    const ext = b.hollow!.doorSide % 2 === 0 ? b.hd : b.hw
    const ground = game.city.terrain.heightAt(b.x, b.z) + 0.2
    game.player.respawnAt(b.x + ox * (ext + 2), Math.max(ground, b.y0 + 0.1), b.z + oz * (ext + 2))
    game.cameraCtl.yaw = Math.atan2(-ox, -oz)
    t.simulate(0.2)

    t.hold('KeyW', 2.2)

    const p = game.player.position
    const inside = Math.abs(p.x - b.x) < b.hw - 0.2 && Math.abs(p.z - b.z) < b.hd - 0.2
    expect(inside).toBe(true)
    const ceiling = game.physics.raycast(p.x, p.y + 1, p.z, 0, 1, 0, 10, Groups.rayCamera)
    expect(ceiling?.y).toBeCloseTo(b.y0 + b.hollow!.floorHeight!, 0)
  })

  test('la cloison intérieure arrête le joueur qui marche tout droit', () => {
    const b = openBuilding()
    const [ox, oz] = SIDE_OUT[b.hollow!.doorSide]
    const depth = b.hollow!.doorSide % 2 === 0 ? b.hd * 2 : b.hw * 2
    // Au milieu de la pièce côté porte : la cloison est à 55 % de la profondeur, son passage décalé.
    const ext = depth / 2
    game.player.respawnAt(b.x + ox * (ext - 1.5), b.y0 + 0.1, b.z + oz * (ext - 1.5))
    game.cameraCtl.yaw = Math.atan2(-ox, -oz)
    t.simulate(0.2)

    t.hold('KeyW', 4)

    const p = game.player.position
    const fromDoor = (b.hollow!.doorSide % 2 === 0 ? (p.z - b.z) * oz : (p.x - b.x) * ox) * -1 + ext
    expect(fromDoor).toBeLessThan(depth * 0.55)
  })

  test('une voiture ne passe pas la porte', () => {
    const b = openBuilding()
    const [ox, oz] = SIDE_OUT[b.hollow!.doorSide]
    const ext = b.hollow!.doorSide % 2 === 0 ? b.hd : b.hw
    const heading = Math.atan2(-ox, -oz)
    const car = game.spawnVehicle('sedan', b.x + ox * (ext + 5), b.y0 + 0.4, b.z + oz * (ext + 5), heading, 'dynamic')
    car.driver = game.debugSpawnActor(b.x, b.z, 0, 6)
    t.simulate(0.2)
    for (let i = 0; i < 180; i++) {
      car.control.throttle = 0.6
      car.control.steer = 0
      t.simulate(1 / 60)
    }

    const p = car.position
    const inside = Math.abs(p.x - b.x) < b.hw - 1 && Math.abs(p.z - b.z) < b.hd - 1
    expect(inside).toBe(false)
  })
})
