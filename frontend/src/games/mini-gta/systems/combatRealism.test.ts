// @vitest-environment jsdom
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { Vector3 } from 'three'
import { Rng } from '../core/rng'
import { createTestGame, type TestGame } from '../game/testing/harness'
import { addWeapon, WEAPONS } from './weapons'

const WEAPON_PISTOL = () => WEAPONS.pistol

vi.mock('../net/api', () => import('../game/testing/fakeApi'))
vi.setConfig({ testTimeout: 30_000 })

const { Actor } = await import('../entities/Actor')
const { CombatNpc, npcAccuracy } = await import('../entities/CombatNpc')
const { policeLook } = await import('../procgen/character/characterModel')

type Npc = InstanceType<typeof CombatNpc>

let t: TestGame
let game: TestGame['game']
let road: Vector3
let along: Vector3
const npcs: Npc[] = []
let shots = 0

function npc(distance: number, weapon: 'pistol' | 'rifle' = 'pistol') {
  const at = road.clone().addScaledVector(along, distance)
  const a = new Actor(game, policeLook(new Rng(9)), 'police', at.x, at.y, at.z)
  const n = new CombatNpc(game, a, weapon)
  n.mode = 'chase'
  npcs.push(n)
  return n
}

function run(seconds: number) {
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    for (const n of npcs) n.update(1 / 60)
    t.simulate(1 / 60)
    for (const n of npcs) n.postStep()
  }
}

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

describe('précision des PNJ', () => {
  const base = { distance: 10, targetSpeed: 0, aimTime: 0, wounded: false, staggered: false }

  test('meilleure sur une cible immobile et proche, pire sur une cible qui court ou lointaine', () => {
    const still = npcAccuracy(0.5, base)

    expect(npcAccuracy(0.5, { ...base, targetSpeed: 6 })).toBeLessThan(still)
    expect(npcAccuracy(0.5, { ...base, distance: 60 })).toBeLessThan(still)
  })

  test('s’affine en visant, se dégrade blessé ou sonné', () => {
    const still = npcAccuracy(0.5, base)

    expect(npcAccuracy(0.5, { ...base, aimTime: 3 })).toBeGreaterThan(still)
    expect(npcAccuracy(0.5, { ...base, wounded: true })).toBeLessThan(still)
    expect(npcAccuracy(0.5, { ...base, staggered: true })).toBeLessThan(still)
  })

  test('reste entre 5 % et 95 %', () => {
    expect(npcAccuracy(5, { ...base, aimTime: 10 })).toBeLessThanOrEqual(0.95)
    expect(npcAccuracy(0.01, { ...base, distance: 200, targetSpeed: 9 })).toBeGreaterThanOrEqual(0.05)
  })
})

describe('comportement au feu des PNJ', () => {
  test('il ne tire pas avant son temps de réaction', () => {
    npc(9)

    run(0.25)

    expect(shots).toBe(0)
  })

  test('il ouvre le feu une fois le temps de réaction écoulé', () => {
    npc(9)

    run(2)

    expect(shots).toBeGreaterThan(0)
  })

  test('il ne tire pas sans ligne de vue', () => {
    const n = npc(9)
    // Le joueur passe derrière un bâtiment : plus de ligne de vue.
    const b = game.city.buildings[0]
    game.player.respawnAt(b.x, 0, b.z)
    run(0.1)
    shots = 0
    n.mode = 'chase'

    run(1)

    expect(n.sees()).toBe(false)
    expect(shots).toBe(0)
  })

  test('blessé et exposé, il se met à l’abri ou recule', () => {
    const n = npc(10)
    run(0.5)
    const d0 = n.actor.position.distanceTo(game.player.actor.position)

    n.actor.health = 30
    run(1.2)

    const hidden = !n.sees()
    const backed = n.actor.position.distanceTo(game.player.actor.position) > d0 + 0.5
    expect(n.mode === 'cover' || hidden || backed).toBe(true)
  })
})

describe('tir du joueur', () => {
  function armed(rounds: number) {
    const p = game.player
    p.inventory.weapons = [{ id: 'fists', clip: 0, ammo: 0 }]
    addWeapon(p.inventory, 'rifle', rounds)
    game.combat.select('rifle')
    t.input.buttons = 0
    t.simulate(0.5)
  }

  test('une rafale élargit la dispersion et fait monter la visée, puis tout se résorbe', () => {
    armed(90)
    const pitch0 = game.cameraCtl.pitch

    t.input.buttons = 1
    t.simulate(0.6)
    t.input.buttons = 0
    for (let i = 0; i < 10; i++) game.combat.render()
    const bloom = game.combat.bloom.value

    expect(bloom).toBeGreaterThan(0)
    expect(game.cameraCtl.pitch).toBeLessThan(pitch0)
    t.simulate(1.5)
    expect(game.combat.bloom.value).toBeLessThan(bloom * 0.1)
  })

  test('une touche affiche le marqueur, rouge si elle tue', () => {
    const target = new Actor(game, policeLook(new Rng(2)), 'civilian', road.x, road.y, road.z)
    const n = new CombatNpc(game, target, 'fists')
    n.mode = 'idle'
    npcs.push(n)
    const origin = target.position
      .clone()
      .addScaledVector(along, -4)
      .setY(target.position.y + 1.1)

    game.combat.hitscan(origin, along, WEAPON_PISTOL(), game.player.actor, origin)
    expect(game.combat.hitMarker?.kill).toBe(false)

    target.health = 1
    game.combat.hitscan(origin, along, WEAPON_PISTOL(), game.player.actor, origin)
    expect(game.combat.hitMarker?.kill).toBe(true)
  })
})
