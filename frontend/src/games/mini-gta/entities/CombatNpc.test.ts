// @vitest-environment jsdom
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { Vector3 } from 'three'
import { Rng } from '../core/rng'
import { createTestGame, type TestGame } from '../game/testing/harness'
import type { WeaponId } from '../systems/weapons'
import type { NpcMode } from './CombatNpc'

vi.mock('../net/api', () => import('../game/testing/fakeApi'))
// Simulations de plusieurs secondes : plus lentes quand toute la suite tourne en parallèle.
vi.setConfig({ testTimeout: 60_000 })

const { Actor } = await import('./Actor')
const { CombatNpc } = await import('./CombatNpc')
const { policeLook } = await import('../procgen/character/characterModel')

type Npc = InstanceType<typeof CombatNpc>

let t: TestGame
let game: TestGame['game']
/** Point de chaussée près du départ et direction de la rue : le joueur s'y tient, les PNJ le long. */
let road: Vector3
let along: Vector3
const npcs: Npc[] = []
let shots: number

function npc(distance: number, weapon: WeaponId = 'pistol', mode: NpcMode = 'chase') {
  const at = road.clone().addScaledVector(along, distance)
  const a = new Actor(game, policeLook(new Rng(5)), 'police', at.x, at.y, at.z)
  const n = new CombatNpc(game, a, weapon)
  n.mode = mode
  npcs.push(n)
  return n
}

/** Fait vivre les PNJ du test au rythme de la simulation. */
function run(seconds: number) {
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    for (const n of npcs) n.update(1 / 60)
    t.simulate(1 / 60)
    for (const n of npcs) n.postStep()
  }
}

const distToPlayer = (n: Npc) => n.actor.position.distanceTo(game.player.actor.position)

beforeAll(async () => {
  t = await createTestGame()
  game = t.game
  const s = game.city.locations.spawn
  const hit = game.nav.nearestEdge(s.x, s.z, 200)!
  const g = game.city.roads.graph
  const pt = g.lanePoint(hit.edge, 1, 0, hit.edge.length * 0.5)
  road = new Vector3(pt.x, game.city.terrain.heightAt(pt.x, pt.z), pt.z)
  const d = g.direction(hit.edge, 1)
  along = new Vector3(d.x, 0, d.z).normalize()
  game.events.on('noise', (n) => {
    if (npcs.some((x) => x.actor === n.source)) shots++
  })
}, 60_000)

afterAll(() => t?.dispose())

beforeEach(() => {
  shots = 0
  game.police.clear()
  game.player.godMode = true
  game.player.respawnAt(road.x, road.y, road.z)
  t.simulate(0.2)
})

afterEach(() => {
  for (const n of npcs.splice(0)) n.dispose()
})

describe('vue', () => {
  test('voit le joueur proche dans la rue', () => {
    const n = npc(10)
    run(0.1)

    expect(n.sees()).toBe(true)
  })

  test('ne voit pas au-delà de sa portée de vue', () => {
    const n = npc(10)
    n.sight = 5
    run(0.1)

    expect(n.sees()).toBe(false)
  })

  test('ne voit pas un joueur à terre', () => {
    const n = npc(10)
    run(0.1)
    game.player.state = 'dead'

    expect(n.sees()).toBe(false)
    game.player.state = 'foot'
  })

  test('vise le véhicule du joueur quand il conduit', () => {
    const car = game.spawnVehicle('sedan', road.x - along.z * 3, road.y + 0.4, road.z + along.x * 3, 0, 'dynamic')
    t.simulate(0.3)
    game.player.respawnAt(car.position.x + 2.5, car.position.y, car.position.z)
    game.player.tryEnterVehicle()
    const n = npc(12)
    run(0.1)

    expect(n.sees()).toBe(true)
    game.player.exitVehicle(true)
    game.removeVehicle(car)
  })
})

describe('comportements', () => {
  test('en poursuite, il tire sur le joueur qu’il voit', () => {
    game.player.godMode = false
    const before = game.player.actor.health
    const n = npc(9)
    n.accuracy = 1

    run(4)

    expect(shots).toBeGreaterThan(0)
    expect(n.actor.anim.aiming).toBe(true)
    expect(game.player.actor.health).toBeLessThan(before)
    game.player.actor.health = game.player.actor.maxHealth
  })

  test('au fusil d’assaut, il tire par rafales', () => {
    npc(9, 'rifle')

    run(3)

    expect(shots).toBeGreaterThanOrEqual(3)
  })

  test('sans autorisation de tirer, il ne fait que suivre', () => {
    const n = npc(9)
    n.hostile = false

    run(3)

    expect(shots).toBe(0)
    expect(n.actor.anim.aiming).toBe(false)
  })

  test('en arrestation, il vient au contact du joueur', () => {
    const n = npc(9, 'pistol', 'arrest')

    run(4)

    expect(distToPlayer(n)).toBeLessThan(2.5)
  })

  test('de loin, il se rapproche en suivant les trottoirs', () => {
    const n = npc(45)
    const start = distToPlayer(n)

    run(5)

    expect(distToPlayer(n)).toBeLessThan(start - 5)
  })

  test('en fuite, il s’éloigne du joueur', () => {
    const n = npc(6, 'pistol', 'flee')
    const start = distToPlayer(n)

    run(2)

    expect(distToPlayer(n)).toBeGreaterThan(start + 3)
  })

  test('un garde qui voit le joueur proche passe à l’attaque', () => {
    const n = npc(10, 'pistol', 'guard')

    run(0.5)

    expect(n.mode).toBe('chase')
  })

  test('un garde loin du joueur regagne son poste', () => {
    const n = npc(10, 'pistol', 'guard')
    n.post = road.clone().addScaledVector(along, 20)
    game.player.respawnAt(road.x - along.x * 150, road.y, road.z - along.z * 150)
    const start = n.actor.position.distanceTo(n.post)

    run(3)

    expect(n.mode).toBe('guard')
    expect(n.actor.position.distanceTo(n.post)).toBeLessThan(start - 2)
  })

  test('inactif, il ne bouge pas de lui-même et ne tire pas', () => {
    const n = npc(10, 'pistol', 'idle')

    run(1)

    expect(n.actor.anim.speed).toBe(0)
    expect(n.actor.anim.aiming).toBe(false)
    expect(shots).toBe(0)
  })

  test('mort, il ne bloque plus les balles et ne tire plus', () => {
    const n = npc(9)
    run(0.1)
    n.actor.damage({ amount: 500, kind: 'bullet' })
    shots = 0

    run(1)
    const c = n.actor.position.clone().setY(n.actor.position.y + 1)
    const from = c.clone().addScaledVector(along, -3)
    const hit = game.physics.raycast(from.x, from.y, from.z, along.x, 0, along.z, 6)

    expect(shots).toBe(0)
    expect(game.physics.ownerOf(hit?.collider)).not.toEqual({ kind: 'character', ref: n.actor })
  })
})
