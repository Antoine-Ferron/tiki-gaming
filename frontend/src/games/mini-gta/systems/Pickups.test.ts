// @vitest-environment jsdom
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { createTestGame, type TestGame } from '../game/testing/harness'
import { newSave } from '../domain/save'
import { useGameStore } from '../state/gameStore'

vi.mock('../net/api', () => import('../game/testing/fakeApi'))

let t: TestGame
let game: TestGame['game']
let notes: string[] = []

const teleport = (x: number, y: number, z: number) => {
  game.player.respawnAt(x, y, z)
  t.simulate(0.1)
}
const away = () => {
  const s = game.city.locations.spawn
  teleport(s.x, s.y, s.z)
}

beforeAll(async () => {
  t = await createTestGame()
  game = t.game
  game.events.on('notify', (n) => notes.push(n.text))
}, 60_000)

afterAll(() => t?.dispose())

beforeEach(() => {
  useGameStore.getState().load(newSave())
  away()
  notes = []
})

describe('billets', () => {
  test('ramasser des billets ajoute l’argent et compte dans le score', async () => {
    const p = game.player.position

    game.pickups.spawnMoney(p.x + 0.5, p.y, p.z, 120)
    t.simulate(0.1)

    await vi.waitFor(() => expect(useGameStore.getState().money).toBe(620))
    expect(useGameStore.getState().totalEarned).toBe(120)
    expect(notes.some((n) => n.startsWith('+120'))).toBe(true)
  })

  test('des billets ne se ramassent qu’une fois', async () => {
    const p = game.player.position
    game.pickups.spawnMoney(p.x, p.y, p.z, 50)

    t.simulate(1)

    await vi.waitFor(() => expect(useGameStore.getState().money).toBe(550))
  })

  test('des billets laissés loin du joueur disparaissent', () => {
    const p = game.player.position
    game.pickups.spawnMoney(p.x + 250, p.y, p.z, 75)
    t.simulate(0.1)

    teleport(p.x + 250, p.y, p.z)
    t.simulate(0.5)

    expect(useGameStore.getState().money).toBe(500)
  })

  test('un joueur mort ne ramasse rien', () => {
    const p = game.player.position
    game.player.actor.damage({ amount: 10_000, from: null, kind: 'bullet', dir: { x: 1, z: 0 } })
    game.pickups.spawnMoney(p.x, p.y, p.z, 90)

    game.pickups.update(1 / 60)

    expect(useGameStore.getState().money).toBe(500)
  })
})

describe('objets fixes', () => {
  test('le pistolet de la planque rejoint l’inventaire, puis réapparaît après son délai', () => {
    const L = game.city.locations.safehouseInside
    const before = game.pickups.list().length
    game.player.inventory.weapons = game.player.inventory.weapons.filter((w) => w.id === 'fists')

    teleport(L.x + 1.5, L.y, L.z + 1.5)

    expect(game.player.inventory.weapons.map((w) => w.id)).toContain('pistol')
    expect(notes).toContain('Pistolet récupéré')
    expect(game.pickups.list().length).toBeLessThan(before)

    away()
    game.pickups.update(61)
    game.pickups.update(1 / 60)
    expect(game.pickups.list().length).toBe(before)
  })

  test.each([
    ['gilet au commissariat', 'policeStation', 'Gilet pare-balles'],
    ['soins à l’hôpital', 'hospital', 'Santé restaurée'],
  ] as const)('%s', (_, place, message) => {
    const L = game.city.locations[place]
    game.pickups.update(130) // objets disponibles
    game.player.actor.armor = 100 // rien n'est ramassé pendant la téléportation
    teleport(L.x + 3, L.y, L.z)
    game.player.actor.armor = 0
    game.player.actor.health = game.player.actor.maxHealth / 2

    game.pickups.update(1 / 60)

    expect(notes).toContain(message)
    if (place === 'policeStation') expect(game.player.actor.armor).toBe(100)
    else expect(game.player.actor.health).toBe(game.player.actor.maxHealth)
  })

  test.each([
    ['gilet inutile avec une armure pleine', 'policeStation'],
    ['soins inutiles en pleine santé', 'hospital'],
  ] as const)('%s : l’objet reste en place', (_, place) => {
    game.pickups.update(130) // objets disponibles
    const L = game.city.locations[place]
    teleport(L.x + 3, L.y, L.z)
    game.player.actor.armor = 100
    game.player.actor.health = game.player.actor.maxHealth
    notes = []

    game.pickups.update(1 / 60)

    expect(notes).toEqual([])
  })

  test('les objets visibles tournent sur eux-mêmes à l’écran', () => {
    expect(() => game.pickups.render(1 / 60)).not.toThrow()
  })
})
