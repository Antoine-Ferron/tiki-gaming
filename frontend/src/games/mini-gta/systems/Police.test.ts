// @vitest-environment jsdom
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { Vector3 } from 'three'
import { Rng } from '../core/rng'
import { createTestGame, type TestGame } from '../game/testing/harness'
import { addWeapon } from './weapons'

vi.mock('../net/api', () => import('../game/testing/fakeApi'))
// Simulations de plusieurs secondes : plus lentes quand toute la suite tourne en parallèle.
vi.setConfig({ testTimeout: 120_000 })

const { Actor } = await import('../entities/Actor')
const { policeLook } = await import('../procgen/character/characterModel')
const { useGameStore } = await import('../state/gameStore')
const { newSave } = await import('../domain/save')

let t: TestGame
let game: TestGame['game']
const FAR = { x: 5000, z: 5000 }
const notes: string[] = []

const policeCars = () => [...game.vehicles].filter((v) => v.tags.has('police') && !v.destroyed)
const officers = () => [...game.police.actors()]

/**
 * Repart du point de départ, à pied, sans recherche ni unités, avec 1 000 $. Les minuteries et le tirage
 * internes de la police (champs privés) reprennent leurs valeurs de début de partie : où apparaissent les
 * renforts et quand tire l'hélicoptère ne dépendent pas des scénarios joués avant.
 */
function reset() {
  Object.assign(game.police as unknown as Record<string, unknown>, {
    rng: new Rng(1717),
    heliAngle: 0,
    heliFire: 3,
    dispatchTimer: 2,
    roadblockTimer: 20,
    bustTimer: 0,
    seenTimer: 0,
    seen: false,
  })
  t.reset()
  game.player.godMode = true
  useGameStore.getState().load({ ...newSave(), money: 1000 })
  notes.length = 0
}

/** Simule `seconds` secondes (le harnais tient à jour la pose affichée des véhicules). */
function play(seconds: number) {
  t.simulate(seconds)
}

/** Avance par tranches jusqu'à ce que la condition soit vraie (ou la limite atteinte). */
function until(cond: () => boolean, maxSeconds: number) {
  for (let s = 0; s < maxSeconds && !cond(); s += 0.5) play(0.5)
  return cond()
}

/** Laisse se résoudre les appels à la (fausse) API. */
const flush = () => new Promise((r) => setTimeout(r, 0))

beforeAll(async () => {
  t = await createTestGame()
  game = t.game
  game.events.on('notify', (n) => notes.push(n.text))
}, 60_000)

afterAll(() => t?.dispose())

beforeEach(reset)

describe('crimes et témoins', () => {
  test.each(['killCop', 'attackCop', 'policeVehicle'] as const)(
    '« %s » est toujours signalé, même sans témoin',
    (crime) => {
      game.police.crime(crime, FAR.x, FAR.z)

      expect(game.police.wanted.stars).toBeGreaterThan(0)
    },
  )

  test('une agression sans aucun témoin passe inaperçue', () => {
    game.police.crime('assault', FAR.x, FAR.z)

    expect(game.police.wanted.stars).toBe(0)
  })

  test('déjà recherché, tout nouveau crime est connu de la police', () => {
    game.police.wanted.setMinimum(1, FAR.x, FAR.z)

    game.police.crime('killCivilian', FAR.x, FAR.z)
    game.police.crime('killCivilian', FAR.x, FAR.z)

    expect(game.police.wanted.stars).toBeGreaterThan(1)
  })

  test('un crime devant un policier est vu', () => {
    const p = game.player.position
    const cop = new Actor(game, policeLook(new Rng(1)), 'police', p.x + 3, p.y, p.z)
    game.police.adoptOfficer(cop, new Vector3(p.x + 3, p.y, p.z))

    game.police.crime('assault', p.x, p.z)

    expect(game.police.wanted.stars).toBeGreaterThan(0)
  })
})

describe('événements du jeu', () => {
  const cop = () => new Actor(game, policeLook(new Rng(2)), 'police', FAR.x, 0, FAR.z)
  const civilian = () => new Actor(game, policeLook(new Rng(2)), 'civilian', FAR.x, 0, FAR.z)

  test('tuer un policier vaut au moins deux étoiles', () => {
    game.events.emit('actor:killed', { actor: cop(), info: { amount: 100, kind: 'bullet', from: game.player.actor } })

    expect(game.police.wanted.stars).toBeGreaterThanOrEqual(2)
  })

  test('blesser un policier vaut au moins deux étoiles', () => {
    game.events.emit('actor:hurt', { actor: cop(), info: { amount: 10, kind: 'melee', from: game.player.actor } })

    expect(game.police.wanted.stars).toBeGreaterThanOrEqual(2)
  })

  test('les violences d’un autre que le joueur ne le concernent pas', () => {
    game.events.emit('actor:killed', { actor: cop(), info: { amount: 100, kind: 'bullet', from: civilian() } })
    game.events.emit('actor:hurt', { actor: cop(), info: { amount: 10, kind: 'bullet', from: null } })

    expect(game.police.wanted.stars).toBe(0)
  })

  test('un bruit fort du joueur est un crime ; un bruit faible, non', () => {
    game.police.wanted.setMinimum(1, FAR.x, FAR.z)
    const before = game.police.wanted.heat

    game.events.emit('noise', { x: FAR.x, y: 0, z: FAR.z, radius: 20, source: game.player.actor })
    const quiet = game.police.wanted.heat
    game.events.emit('noise', { x: FAR.x, y: 0, z: FAR.z, radius: 100, source: game.player.actor })
    const shot = game.police.wanted.heat
    game.events.emit('noise', { x: FAR.x, y: 0, z: FAR.z, radius: 180, source: game.player.actor })

    expect(quiet).toBe(before)
    expect(shot - quiet).toBeCloseTo(1.5)
    expect(game.police.wanted.heat - shot).toBeCloseTo(4)
  })

  test('voler une voiture de police ou l’attaquer est un crime', () => {
    const p = game.player.position
    const car = game.spawnVehicle('police', p.x + 6, p.y + 0.4, p.z, 0, 'dynamic')

    game.events.emit('vehicle:entered', { vehicle: car, jacked: false })
    const entered = game.police.wanted.stars
    game.police.clear()
    game.events.emit('vehicle:attacked', { vehicle: car })

    expect(entered).toBeGreaterThan(0)
    expect(game.police.wanted.stars).toBeGreaterThanOrEqual(1)
    game.removeVehicle(car)
  })

  test('voler une voiture civile occupée est un crime, la prendre vide non', () => {
    const p = game.player.position
    const car = game.spawnVehicle('sedan', FAR.x, 0.4, FAR.z, 0, 'dynamic')

    game.events.emit('vehicle:entered', { vehicle: car, jacked: false })
    const empty = game.police.wanted.stars
    game.police.wanted.setMinimum(1, p.x, p.z)
    game.events.emit('vehicle:entered', { vehicle: car, jacked: true })

    expect(empty).toBe(0)
    expect(game.police.wanted.stars).toBeGreaterThanOrEqual(1)
    game.removeVehicle(car)
  })
})

describe('intervention', () => {
  test('deux étoiles : des voitures de police arrivent sirène allumée', () => {
    const p = game.player.position
    game.police.wanted.setMinimum(2, p.x, p.z)

    t.simulate(8)

    expect(policeCars().length).toBeGreaterThan(0)
    expect(policeCars().every((v) => v.sirenOn)).toBe(true)
  })

  test('la recherche levée, les voitures coupent la sirène et repartent', () => {
    const p = game.player.position
    game.police.wanted.setMinimum(2, p.x, p.z)
    t.simulate(8)

    game.police.wanted.clear()
    t.simulate(0.5)

    expect(policeCars().every((v) => !v.sirenOn)).toBe(true)
    expect(officers().every((a) => !a.anim.aiming)).toBe(true)
  })

  test('une étoile : les voitures arrivent et l’équipage descend près du joueur à pied', () => {
    // Au milieu de la rue, le joueur reste en vue des voitures qui arrivent.
    const at = game.nav.nearestEdge(game.player.position.x, game.player.position.z, 200)!
    const pt = game.city.roads.graph.lanePoint(at.edge, 1, 0, at.edge.length * 0.5)
    game.player.respawnAt(pt.x, 0, pt.z)
    const p = game.player.position
    game.police.wanted.setMinimum(1, p.x, p.z)

    // Le joueur reste recherché pendant l'arrivée des renforts (la perte de vue est testée à part).
    const deployed = until(() => {
      game.police.wanted.unseen = 0
      return officers().some((a) => a.position.distanceTo(p) < 40)
    }, 60)

    expect(deployed).toBe(true)
  })

  test('une ou deux étoiles, immobile, un policier au contact : arrestation, caution et armes perdues', async () => {
    const p = game.player.position
    addWeapon(game.player.inventory, 'pistol', 30)
    game.police.wanted.setMinimum(1, p.x, p.z)
    const cop = new Actor(game, policeLook(new Rng(4)), 'police', p.x + 1.5, p.y, p.z)
    game.police.adoptOfficer(cop, new Vector3(p.x + 1.5, p.y, p.z))

    const busted = until(() => game.player.state === 'busted', 20)
    expect(busted).toBe(true)
    expect(notes).toContain('ARRÊTÉ')

    play(5)
    await flush()
    expect(game.player.state).toBe('foot')
    expect(game.police.wanted.stars).toBe(0)
    expect(game.player.inventory.weapons.map((w) => w.id)).toEqual(['fists'])
    expect(useGameStore.getState().money).toBe(800)
  })

  test('mort : le joueur réapparaît à l’hôpital et paie les frais', async () => {
    game.player.godMode = false

    game.player.actor.damage({ amount: 1000, kind: 'fall' })
    t.simulate(5)
    await flush()

    const h = game.city.locations.hospital
    expect(game.player.state).toBe('foot')
    expect(Math.hypot(game.player.position.x - h.x, game.player.position.z - h.z)).toBeLessThan(3)
    expect(useGameStore.getState().money).toBe(900)
    expect(notes).toContain('K.O.')
  })

  test('trois étoiles : un hélicoptère de police survole le joueur', () => {
    const p = game.player.position
    game.police.wanted.setMinimum(3, p.x, p.z)

    t.simulate(10)

    const heli = [...game.vehicles].find((v) => v.spec.id === 'policeHeli')
    expect(heli).toBeDefined()
    expect(heli!.position.distanceTo(p)).toBeLessThan(260)
    expect(heli!.position.y).toBeGreaterThan(p.y + 15)
  })

  test('quatre étoiles : le tireur de l’hélicoptère blesse le joueur', () => {
    game.player.godMode = false
    const p = game.player.position
    game.police.wanted.setMinimum(4, p.x, p.z)
    const before = game.player.actor.health

    until(() => game.player.actor.health < before || game.player.state !== 'foot', 40)

    expect(game.player.actor.health).toBeLessThan(before)
  })

  test('l’hélicoptère détruit n’éclaire plus et disparaît une fois loin', () => {
    const p = game.player.position
    game.police.wanted.setMinimum(3, p.x, p.z)
    t.simulate(6)
    const heli = [...game.vehicles].find((v) => v.spec.id === 'policeHeli')!

    heli.explode()
    t.simulate(0.2)
    const s = game.city.locations.spawn
    game.player.respawnAt(s.x + 900, s.y, s.z)
    t.simulate(0.5)

    expect(game.vehicles.has(heli)).toBe(false)
  })
})

describe('fin de la poursuite', () => {
  test('hors de vue assez longtemps, le joueur sème la police', () => {
    // Loin de toute route : aucune voiture de police ne peut venir le chercher, il reste hors de vue.
    const hideout = { x: -800, z: -1200 }
    t.reset(hideout)
    expect(game.nav.edgesInRing(hideout.x, hideout.z, 0, 200)).toHaveLength(0)
    game.police.wanted.setMinimum(1, FAR.x, FAR.z)

    const lost = until(() => game.police.wanted.stars === 0, 120)

    expect(lost).toBe(true)
    expect(notes).toContain('Tu as semé la police')
  })

  test('loin de tout, les unités et les policiers sont renvoyés', () => {
    const p = game.player.position
    game.police.wanted.setMinimum(2, p.x, p.z)
    until(() => officers().length > 0, 40)
    expect(policeCars().length + officers().length).toBeGreaterThan(0)

    const s = game.city.locations.spawn
    game.player.respawnAt(s.x + 900, s.y, s.z)
    game.police.wanted.clear()
    t.simulate(0.5)

    expect(policeCars()).toHaveLength(0)
    expect(officers()).toHaveLength(0)
  })

  test('clear() retire la recherche, les unités, les policiers et l’hélicoptère', () => {
    const p = game.player.position
    game.police.wanted.setMinimum(3, p.x, p.z)
    t.simulate(10)

    game.police.clear()

    expect(game.police.wanted.stars).toBe(0)
    expect(policeCars()).toHaveLength(0)
    expect(officers()).toHaveLength(0)
    expect([...game.vehicles].some((v) => v.spec.id === 'policeHeli')).toBe(false)
  })
})
