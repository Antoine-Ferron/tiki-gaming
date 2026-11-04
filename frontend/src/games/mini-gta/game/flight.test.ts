// @vitest-environment jsdom
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from 'vitest'
import type { Vehicle } from '../entities/Vehicle'
import { createTestGame, type TestGame } from './testing/harness'

vi.mock('../net/api', () => import('./testing/fakeApi'))
vi.setConfig({ testTimeout: 60_000 })

/** Vol : essais sur une zone dégagée (x = −600, le fixture n'a de bâtiments qu'autour du départ). */
let t: TestGame
let game: TestGame['game']
let craft: Vehicle | null = null

beforeAll(async () => {
  t = await createTestGame()
  game = t.game
}, 60_000)

afterAll(() => t?.dispose())

afterEach(() => {
  for (const k of ['KeyW', 'KeyS', 'KeyD', 'ShiftLeft']) t.key(k, false)
  if (game.player.state === 'vehicle') game.player.exitVehicle(true)
  if (craft) game.removeVehicle(craft)
  craft = null
})

function board(id: 'heli' | 'plane', z: number): Vehicle {
  const v = game.spawnVehicle(id, -600, 0.3, z, 0, 'dynamic')
  t.simulate(0.3)
  game.player.respawnAt(-597, 0.3, z)
  t.simulate(0.1)
  game.player.tryEnterVehicle()
  craft = v
  return v
}

const kmh = (v: Vehicle) => {
  const lv = v.body.linvel()
  return Math.hypot(lv.x, lv.z) * 3.6
}

describe('hélicoptère', () => {
  function airborne() {
    const heli = board('heli', -900)
    t.hold('ShiftLeft', 4)
    return heli
  }

  test('nez baissé, il dépasse 180 km/h en palier', () => {
    const heli = airborne()
    const y0 = heli.position.y

    t.key('KeyW', true)
    t.until(() => kmh(heli) > 180, 14)

    expect(kmh(heli)).toBeGreaterThan(180)
    expect(Math.abs(heli.position.y - y0)).toBeLessThan(25)
  })

  test('manche lâché, il se stabilise en stationnaire sans perdre d’altitude', () => {
    const heli = airborne()
    t.hold('KeyW', 4)
    const y0 = heli.position.y

    t.simulate(6)

    expect(kmh(heli)).toBeLessThan(25)
    expect(Math.abs(heli.position.y - y0)).toBeLessThan(6)
  })
})

describe('avion', () => {
  test('il décolle en moins de 9 s et dépasse 300 km/h', () => {
    const plane = board('plane', -1000)
    let takeoff = Infinity

    t.key('ShiftLeft', true)
    for (let i = 1; i <= 140 && kmh(plane) <= 300; i++) {
      t.simulate(0.1)
      if (takeoff === Infinity && plane.position.y > 3) takeoff = i / 10
    }

    expect(takeoff).toBeLessThan(9)
    expect(kmh(plane)).toBeGreaterThan(300)
  })

  test('la traînée plafonne sa vitesse vers 380 km/h', () => {
    const plane = board('plane', -1000)

    t.key('ShiftLeft', true)
    t.simulate(20)

    expect(plane.speed * 3.6).toBeGreaterThan(330)
    expect(plane.speed * 3.6).toBeLessThan(400)
  })

  test('incliné puis cabré, il vire sans décrocher', () => {
    const plane = board('plane', -1000)
    t.key('ShiftLeft', true)
    t.simulate(12)
    const y0 = plane.position.y
    const h0 = plane.heading()
    let lowest = Infinity

    t.hold('KeyD', 0.4)
    t.key('KeyS', true)
    for (let i = 0; i < 20; i++) {
      t.simulate(0.1)
      lowest = Math.min(lowest, plane.position.y)
    }

    expect(Math.abs(plane.heading() - h0)).toBeGreaterThan(1)
    expect(lowest).toBeGreaterThan(y0 - 5)
  })
})
