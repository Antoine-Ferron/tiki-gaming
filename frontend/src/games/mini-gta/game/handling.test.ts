// @vitest-environment jsdom
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from 'vitest'
import { Vector3 } from 'three'
import type { Vehicle } from '../entities/Vehicle'
import { createTestGame, type TestGame } from './testing/harness'

vi.mock('../net/api', () => import('./testing/fakeApi'))
vi.setConfig({ testTimeout: 60_000 })

/**
 * Comportement routier : boîte de vitesses, traînée, freinage, adhérence des pneus. Essais sur une ligne droite
 * dégagée de 2 km (x = −600 : le fixture n'a de bâtiments qu'autour du départ).
 */
let t: TestGame
let game: TestGame['game']
let car: Vehicle | null = null

beforeAll(async () => {
  t = await createTestGame()
  game = t.game
}, 60_000)

afterAll(() => t?.dispose())

afterEach(() => {
  for (const k of ['KeyW', 'KeyS', 'KeyD', 'Space']) t.key(k, false)
  if (game.player.state === 'vehicle') game.player.exitVehicle(true)
  if (car) game.removeVehicle(car)
  car = null
})

/** Véhicule neuf au départ de la piste, orienté vers +Z, conducteur à bord, lancé à `v0` m/s. */
function onTrack(id: string, v0 = 0): Vehicle {
  const v = game.spawnVehicle(id, -600, 0.3, -1000, 0, 'dynamic')
  t.simulate(0.3)
  game.player.respawnAt(-597.5, 0.3, -1000)
  t.simulate(0.1)
  game.player.tryEnterVehicle()
  v.body.setLinvel({ x: 0, y: 0, z: v0 }, true)
  car = v
  return v
}

const kmh = (v: Vehicle) => v.speed * 3.6

describe('moteur et boîte', () => {
  test('la berline passe de 0 à 100 km/h en moins de 8 s en montant les rapports', () => {
    const v = onTrack('sedan')
    const gears = new Set<number>()

    t.key('KeyW', true)
    t.until(() => {
      gears.add(v.gear)
      return kmh(v) >= 100
    }, 8)

    expect(kmh(v)).toBeGreaterThanOrEqual(100)
    expect(gears.size).toBeGreaterThanOrEqual(4)
  })

  test.each([
    ['sport', 0.85],
    ['sedan', 0.85],
  ])('%s : la traînée plafonne la vitesse près de sa vitesse de pointe', (id, ratio) => {
    const v = onTrack(id, 30)

    t.key('KeyW', true)
    t.simulate(20)

    expect(v.speed).toBeGreaterThan(v.spec.maxSpeed * ratio)
    expect(v.speed).toBeLessThanOrEqual(v.spec.maxSpeed * 1.02)
  })

  test('la moto file à plus de 150 km/h sans toucher le sol', () => {
    const v = onTrack('bike', 20)

    t.key('KeyW', true)
    t.until(() => kmh(v) > 150, 12)

    expect(kmh(v)).toBeGreaterThan(150)
    expect(v.destroyed).toBe(false)
  })
})

describe('freins et pneus', () => {
  test('de 100 km/h à l’arrêt en moins de 50 m', () => {
    const v = onTrack('sedan', 100 / 3.6)
    t.simulate(0.2)
    const p0 = v.position.clone()

    t.key('KeyS', true)
    t.until(() => v.speed < 0.5, 8)

    expect(v.position.distanceTo(p0)).toBeLessThan(50)
  })

  test('braquage à fond à 60 km/h : la voiture tourne sans se retourner', () => {
    const v = onTrack('sedan', 60 / 3.6)
    const h0 = v.heading()
    let lowestUp = 1

    t.key('KeyD', true)
    for (let i = 0; i < 120; i++) {
      t.simulate(1 / 60)
      lowestUp = Math.min(lowestUp, new Vector3(0, 1, 0).applyQuaternion(v.visual.root.quaternion).y)
    }

    expect(Math.abs(v.heading() - h0)).toBeGreaterThan(0.8)
    expect(lowestUp).toBeGreaterThan(0.8)
  })

  test('au frein à main, l’arrière décroche : la voiture pivote plus vite qu’en braquant seule', () => {
    const yawIn = (handbrake: boolean) => {
      const v = onTrack('sedan', 18)
      t.key('KeyW', true)
      t.key('KeyD', true)
      if (handbrake) t.key('Space', true)
      const h0 = v.heading()
      t.simulate(0.8)
      const yaw = Math.abs(v.heading() - h0)
      for (const k of ['KeyW', 'KeyD', 'Space']) t.key(k, false)
      game.player.exitVehicle(true)
      game.removeVehicle(v)
      car = null
      return yaw
    }

    expect(yawIn(true)).toBeGreaterThan(yawIn(false) * 1.2)
  })

  test('à l’arrêt, la voiture garée ne glisse pas', () => {
    const v = onTrack('sedan')
    game.player.exitVehicle(true)
    const p0 = v.position.clone()

    t.simulate(3)

    expect(v.position.distanceTo(p0)).toBeLessThan(0.1)
  })
})
