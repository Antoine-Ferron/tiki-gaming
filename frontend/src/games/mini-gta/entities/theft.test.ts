// @vitest-environment jsdom
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { createTestGame, type TestGame } from '../game/testing/harness'
import type { Vehicle } from './Vehicle'
import { Rng } from '../core/rng'
import { policeLook } from '../procgen/character/characterModel'
import { Actor } from './Actor'
import { ENTRY_TIMES } from './Player'

vi.mock('../net/api', () => import('../game/testing/fakeApi'))
vi.setConfig({ testTimeout: 60_000 })

/** Vol de voitures : entrée progressive, serrures forcées, car-jacking et réactions des occupants. */
let t: TestGame
let game: TestGame['game']
const spawned: Vehicle[] = []

beforeAll(async () => {
  t = await createTestGame()
  game = t.game
}, 60_000)

afterAll(() => t?.dispose())

// Sans recherche ni policier laissés par un vol précédent (voiture de police volée) : pas d'arrestation surprise.
beforeEach(() => t.reset())

afterEach(() => {
  for (const k of ['KeyW', 'KeyF']) t.key(k, false)
  game.player.entry = null
  if (game.player.state === 'vehicle') game.player.exitVehicle(true)
  for (const v of spawned.splice(0)) if (game.vehicles.has(v)) game.removeVehicle(v)
  t.simulate(0.1)
})

let slot = 0
/** Véhicule posé sur la rue du départ, chacun à sa place ; le joueur à 3 m de sa portière. */
function park(id = 'sedan', opts: { locked?: boolean } = {}): Vehicle {
  const s = game.city.locations.spawn
  const g = game.city.roads.graph
  const e = game.nav.nearestEdge(s.x, s.z)!.edge
  const a = g.nodes[e.a]
  const d = g.direction(e, 1)
  const k = 12 + 14 * (slot++ % 5)
  let v = game.spawnVehicle(id, a.x + d.x * k, 0.3, a.z + d.z * k, Math.atan2(d.x, d.z), 'dynamic')
  // Cherche un véhicule du verrouillage voulu (le tirage dépend de la position).
  for (let tries = 0; opts.locked !== undefined && game.player.isLocked(v) !== opts.locked && tries < 40; tries++) {
    game.removeVehicle(v)
    v = game.spawnVehicle(id, a.x + d.x * k + (tries + 1) * 0.37, 0.3, a.z + d.z * k, Math.atan2(d.x, d.z), 'dynamic')
  }
  spawned.push(v)
  t.simulate(0.3)
  v.visual.root.updateMatrixWorld(true)
  const door = v.visual.exit.clone().applyMatrix4(v.visual.root.matrixWorld)
  const out = door.clone().sub(v.position).setY(0).normalize()
  game.player.respawnAt(door.x + out.x * 1.5, 0.3, door.z + out.z * 1.5)
  // Laisse passer le court délai qui suit une sortie de véhicule (test précédent).
  t.simulate(0.7)
  return v
}

/** Pose un conducteur (et des passagers) civils dans le véhicule. */
function occupy(v: Vehicle, passengers = 0) {
  v.driver = game.peds.createSeated(v)
  for (let i = 0; i < passengers; i++) v.passengers.push(game.peds.createSeated(v))
}

const total = (...phases: (keyof typeof ENTRY_TIMES)[]) => phases.reduce((s, p) => s + ENTRY_TIMES[p], 0)

describe('monter dans un véhicule', () => {
  test('prend du temps : le joueur va à la portière puis monte', () => {
    const v = park('sedan', { locked: false })

    t.press('KeyF')
    t.simulate(0.3)
    expect(game.player.state).toBe('foot')
    expect(game.player.entry?.vehicle).toBe(v)

    t.until(() => game.player.state === 'vehicle', 4)
    expect(game.player.vehicle).toBe(v)
  })

  test('bouger annule l’entrée', () => {
    park('sedan', { locked: false })

    t.press('KeyF')
    t.simulate(0.2)
    t.hold('KeyW', 0.2)
    t.simulate(1.5)

    expect(game.player.entry).toBeNull()
    expect(game.player.state).toBe('foot')
  })

  test('appuyer de nouveau sur F annule aussi', () => {
    park('sedan', { locked: false })

    t.press('KeyF')
    t.simulate(0.2)
    t.press('KeyF')
    t.simulate(0.1)

    expect(game.player.entry).toBeNull()
  })

  test('un véhicule hors d’atteinte fait abandonner', () => {
    const v = park('sedan', { locked: false })
    t.press('KeyF')
    t.simulate(0.1)

    v.body.setTranslation({ x: v.position.x + 40, y: v.position.y, z: v.position.z }, true)
    t.simulate(0.2)

    expect(game.player.entry).toBeNull()
  })

  test('la touche F loin de tout véhicule ne fait rien', () => {
    game.player.respawnAt(game.city.locations.spawn.x, 0.3, game.city.locations.spawn.z - 200)
    t.simulate(0.1)

    t.press('KeyF')
    t.simulate(0.1)

    expect(game.player.entry).toBeNull()
  })
})

describe('voiture garée verrouillée', () => {
  test('il faut forcer la portière : bris de vitre, alarme et vol signalé', () => {
    const v = park('sedan', { locked: true })
    const crime = vi.spyOn(game.police, 'crime')
    const noises: number[] = []
    const off = game.events.on('noise', (n) => noises.push(n.radius))
    const phases = new Set<string>()

    t.press('KeyF')
    t.until(
      () => {
        if (game.player.entry) phases.add(game.player.entry.phase)
        return game.player.state === 'vehicle'
      },
      total('approachMax', 'force', 'enter') + 1,
    )

    expect(phases.has('force')).toBe(true)
    expect(game.player.vehicle).toBe(v)
    expect(crime).toHaveBeenCalledWith('vehicleAttack', expect.any(Number), expect.any(Number))
    expect(noises).toContain(40)
    expect(game.player.isLocked(v)).toBe(false)
    off()
    crime.mockRestore()
  })

  test('les motos, avions et véhicules de mission ne sont jamais verrouillés', () => {
    const bike = park('bike')
    const car = park('sedan')
    car.persistent = true

    expect(game.player.isLocked(bike)).toBe(false)
    expect(game.player.isLocked(car)).toBe(false)
  })

  test('le verrouillage est stable pour un même véhicule', () => {
    const v = park('sedan')

    expect(game.player.isLocked(v)).toBe(game.player.isLocked(v))
  })
})

describe('car-jacking', () => {
  test('le joueur sort le conducteur, qui s’enfuit, et le vol est signalé', () => {
    const v = park('sedan')
    occupy(v)
    const before = game.peds.count
    const crime = vi.spyOn(game.police, 'crime')

    t.press('KeyF')
    t.simulate(0.05)
    game.player.entry!.reaction = 'flee'
    const phases = new Set<string>()
    t.until(
      () => {
        if (game.player.entry) phases.add(game.player.entry.phase)
        return game.player.state === 'vehicle'
      },
      total('approachMax', 'pull') + 1,
    )

    expect(phases.has('pull')).toBe(true)
    expect(game.player.vehicle).toBe(v)
    expect(game.peds.count).toBe(before + 1)
    expect(crime).toHaveBeenCalledWith('carjack', expect.any(Number), expect.any(Number))
    crime.mockRestore()
  })

  test('les passagers sortent et fuient', () => {
    const v = park('sedan')
    occupy(v, 2)
    const before = game.peds.count

    game.player.tryEnterVehicle()

    expect(v.passengers).toEqual([])
    expect(game.peds.count).toBe(before + 3)
  })

  test('certains conducteurs démarrent en trombe avant que le voleur n’arrive', () => {
    const v = park('sedan')
    occupy(v)
    // Sur le côté conducteur, à 4,2 m du centre : le temps de marcher jusqu'à la portière.
    v.visual.root.updateMatrixWorld(true)
    const side = v.visual.exit.clone().applyMatrix4(v.visual.root.matrixWorld).sub(v.position).setY(0).normalize()
    game.player.respawnAt(v.position.x + side.x * 4.2, 0.3, v.position.z + side.z * 4.2)
    t.simulate(0.1)

    game.player.beginEnterVehicle()
    game.player.entry!.reaction = 'speedOff'
    t.simulate(ENTRY_TIMES.speedOffDelay + 0.2)
    const p0 = v.position.clone()
    t.simulate(2.5)

    expect(game.player.entry).toBeNull()
    expect(game.player.state).toBe('foot')
    expect(v.position.distanceTo(p0)).toBeGreaterThan(5)
  })

  test('un conducteur furieux frappe le voleur, puis abandonne', () => {
    const v = park('sedan')
    occupy(v)
    const health = game.player.actor.health
    const before = game.peds.count

    game.peds.ejectDriver(v, 'fight')
    t.simulate(3)

    expect(game.peds.count).toBe(before + 1)
    expect(game.player.actor.health).toBeLessThan(health)
    // Le voleur part en voiture : la bagarre cesse.
    game.player.tryEnterVehicle()
    t.simulate(0.5)
    expect(game.player.state).toBe('vehicle')
  })

  test('un policier sorti de sa voiture redevient un agent hostile', () => {
    const v = park('police')
    const cop = new Actor(game, policeLook(new Rng(9)), 'police', v.position.x, v.position.y, v.position.z)
    cop.seatedIn = v
    v.driver = cop
    game.peds.adoptSeated(cop)
    const officers = [...game.police.actors()].length

    game.player.tryEnterVehicle()

    expect([...game.police.actors()].length).toBe(officers + 1)
  })
})

describe('invites', () => {
  test('l’invite annonce la serrure à forcer, puis la progression', () => {
    park('sedan', { locked: true })
    t.simulate(0.05)
    expect(game.interactions.prompt).toContain('forcer la portière')

    t.press('KeyF')
    t.until(() => game.player.entry?.phase === 'force', 3)
    t.simulate(0.5)

    expect(game.interactions.prompt).toMatch(/Tu forces la portière… \d+ %/)
  })

  test('un véhicule occupé propose de sortir le conducteur', () => {
    const v = park('sedan')
    occupy(v)
    t.simulate(0.05)

    expect(game.interactions.prompt).toContain('sortir le conducteur')
  })
})
