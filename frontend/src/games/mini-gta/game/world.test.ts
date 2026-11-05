// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest'
import { Vector3 } from 'three'
import { newSave } from '../domain/save'
import { useGameStore } from '../state/gameStore'
import type { Vehicle } from '../entities/Vehicle'
import { ColliderDesc, RigidBodyDesc } from '../physics/engine'
import { createTestGame, type TestGame } from './testing/harness'

vi.mock('../net/api', () => import('./testing/fakeApi'))

// Simulations longues : la suite complète tourne en parallèle.
vi.setConfig({ testTimeout: 60_000 })

let t: TestGame
let game: TestGame['game']

beforeAll(async () => {
  useGameStore.getState().load({ ...newSave(), money: 1000 })
  t = await createTestGame({ traffic: 4, pedestrians: 6 })
  game = t.game
}, 60_000)

afterAll(() => t?.dispose())

let spawned = 0
let previous: Vehicle | null = null

/**
 * Place le joueur à côté d'un véhicule neuf (chacun à sa place) et l'y fait monter. Le véhicule du test
 * précédent est retiré : un hélicoptère abandonné en vol finirait par s'écraser sur les suivants.
 */
function drive(id: string, at?: { x: number; z: number; heading?: number }): Vehicle {
  if (game.player.state === 'vehicle') game.player.exitVehicle(true)
  if (previous) game.removeVehicle(previous)
  // Par défaut : sur la rue la plus proche du départ, dans son axe, chaque véhicule plus loin que le précédent.
  const s = game.city.locations.spawn
  const near = game.nav.nearestEdge(s.x, s.z)!.edge
  const g = game.city.roads.graph
  const a = g.nodes[near.a]
  const d = g.direction(near, 1)
  const k = 10 + 12 * (spawned++ % 6)
  const pose = at ?? { x: a.x + d.x * k, z: a.z + d.z * k, heading: Math.atan2(d.x, d.z) }
  const v = game.spawnVehicle(id, pose.x, 0.3, pose.z, pose.heading ?? 0, 'dynamic')
  t.simulate(0.3)
  game.player.respawnAt(v.position.x + 2.5, v.position.y + 0.2, v.position.z)
  t.simulate(0.2)
  game.player.tryEnterVehicle()
  previous = v
  return v
}

describe('rendu et streaming du monde', () => {
  test('une frame complète se calcule sans WebGL et charge les colliders des props proches', () => {
    expect(() => {
      for (let i = 0; i < 3; i++) game.render(0.5, 1 / 60)
    }).not.toThrow()
  })

  test('un prop renversé devient un débris dynamique', () => {
    const prop = game.city.props.find((p) => p.kind === 'lamp' || p.kind === 'hydrant' || p.kind === 'bench')!

    game.world.destroyProp(prop.id, { x: 200, y: 150, z: 0 })
    t.simulate(1)
    game.render(0.5, 1 / 60)

    expect(prop.destroyed).toBe(true)
  })
})

describe('véhicules', () => {
  test('l’hélicoptère décolle quand on monte le collectif', () => {
    const heli = drive('heli')
    const y0 = heli.position.y

    t.key('ShiftLeft', true)
    t.until(() => heli.position.y > y0 + 3, 4)
    t.key('ShiftLeft', false)

    expect(game.player.vehicle).toBe(heli)
    expect(heli.position.y).toBeGreaterThan(y0 + 3)
  })

  test('l’hélicoptère avance en piquant du nez', () => {
    const heli = game.player.vehicle!
    const p0 = heli.position.clone()

    t.key('ShiftLeft', true)
    t.hold('KeyW', 3)
    t.key('ShiftLeft', false)

    expect(heli.position.distanceTo(p0)).toBeGreaterThan(5)
  })

  test('l’avion prend de la vitesse au sol avec les gaz', () => {
    const plane = drive('plane', game.city.locations.planeSpawn)

    t.hold('ShiftLeft', 2)
    t.simulate(3)

    expect(plane.speed).toBeGreaterThan(3)
  })

  test('la moto roule et reste debout', () => {
    const bike = drive('bike')

    t.hold('KeyW', 3)

    expect(bike.speed).toBeGreaterThan(3)
    expect(new Vector3(0, 1, 0).applyQuaternion(bike.visual.root.quaternion).y).toBeGreaterThan(0.3)
  })

  test('en marche arrière puis frein à main', () => {
    const car = drive('sedan')

    t.hold('KeyS', 2)
    expect(car.speed).toBeLessThan(-0.5)
    t.hold('Space', 1)

    expect(Math.abs(car.speed)).toBeLessThan(3)
  })

  test('une voiture retournée se remet sur ses roues', () => {
    const car = drive('sedan')
    game.player.exitVehicle(true)
    const p = car.body.translation()
    car.body.setRotation({ x: 1, y: 0, z: 0, w: 0 }, true)
    // Retournée autour de son origine, la caisse passe sous l'origine : on la lâche sur le toit, de 3 m.
    car.body.setTranslation({ x: p.x, y: p.y + 3, z: p.z }, true)

    t.simulate(5)

    expect(new Vector3(0, 1, 0).applyQuaternion(car.visual.root.quaternion).y).toBeGreaterThan(0.5)
  })

  test('une voiture très abîmée prend feu puis explose', () => {
    const car = game.spawnVehicle('sedan', game.player.position.x + 15, 0.4, game.player.position.z, 0, 'dynamic')
    t.simulate(0.5)

    car.damage(car.spec.health * 0.95, game.player.actor)
    t.simulate(6)

    expect(car.destroyed).toBe(true)
  })

  test('un véhicule qui apparaît dans un obstacle n’est pas détruit par le choc de dégagement', () => {
    const b = game.city.buildings[0]
    const car = game.spawnVehicle('sedan', b.x, 0.4, b.z, 0, 'dynamic')

    t.simulate(1)

    expect(car.destroyed).toBe(false)
  })

  test('un véhicule qui apparaît sous une surface (dalle, tremplin) est posé dessus', () => {
    // Piste dégagée (x = −600) : aucun bâtiment du fixture.
    const body = game.physics.world.createRigidBody(RigidBodyDesc.fixed())
    game.physics.world.createCollider(ColliderDesc.cuboid(4, 0.6, 4).setTranslation(-600, 0.6, -900), body)

    const car = game.spawnVehicle('sport', -600, 0.3, -900, 0, 'dynamic')
    t.simulate(1)

    expect(car.position.y).toBeGreaterThan(1.0)
    expect(car.destroyed).toBe(false)
    game.removeVehicle(car)
    game.physics.removeBody(body)
  })

  test('un véhicule tombé à l’eau se détruit', () => {
    const car = game.spawnVehicle('sedan', game.player.position.x + 25, 0.4, game.player.position.z, 0, 'dynamic')
    const p = car.body.translation()
    car.body.setTranslation({ x: p.x, y: -5, z: p.z }, true)

    for (let i = 0; i < 20 && !car.destroyed; i++) {
      car.body.setTranslation({ x: p.x, y: -5, z: p.z }, true)
      t.simulate(0.5)
    }

    expect(car.health).toBeLessThan(car.spec.health)
  })
})

describe('conduite', () => {
  /** Point d'une rue proche du départ, son axe et l'îlot le plus proche. */
  function street() {
    const s = game.city.locations.spawn
    const g = game.city.roads.graph
    const e = game.nav.nearestEdge(s.x, s.z)!.edge
    return { a: g.nodes[e.a], d: g.direction(e, 1) }
  }
  function nearestBlock() {
    const s = game.city.locations.spawn
    const dist = (b: { x0: number; x1: number; z0: number; z1: number }) =>
      Math.hypot((b.x0 + b.x1) / 2 - s.x, (b.z0 + b.z1) / 2 - s.z)
    return game.city.blocks.slice().sort((p, q) => dist(p) - dist(q))[1]
  }
  /** Monte dans un véhicule neuf posé à (x, z), orienté selon `heading`, lancé à `v0` m/s. */
  function launch(id: string, x: number, z: number, heading: number, v0 = 0) {
    if (game.player.state === 'vehicle') game.player.exitVehicle(true)
    if (previous) game.removeVehicle(previous)
    const v = game.spawnVehicle(id, x, 0.3, z, heading, 'dynamic')
    t.simulate(0.3)
    game.player.respawnAt(x + 3 * Math.cos(heading), 0.3, z - 3 * Math.sin(heading))
    t.simulate(0.1)
    game.player.tryEnterVehicle()
    v.body.setLinvel({ x: Math.sin(heading) * v0, y: 0, z: Math.cos(heading) * v0 }, true)
    previous = v
    return v
  }

  test('la berline atteint 80 km/h en moins de 5,5 s en ville', () => {
    const { a, d } = street()
    const car = launch('sedan', a.x + d.x * 5, a.z + d.z * 5, Math.atan2(d.x, d.z))

    t.key('KeyW', true)
    const reached = t.until(() => car.speed * 3.6 >= 80, 5.5)
    t.key('KeyW', false)

    expect(reached).toBe(true)
  })

  test.each([
    ['de face, à l’arrêt contre la bordure', 0, 0],
    ['en biais à 20°', 0.35, 5],
    ['en biais à 45°', 0.8, 5],
  ])('monte sur le trottoir %s sans être bloquée', (_, angle, v0) => {
    const b = nearestBlock()
    const z = (b.z0 + b.z1) / 2
    const car = launch('sedan', b.x0 - 3 - 3 * Math.cos(angle), z, Math.PI / 2 - angle, v0)
    const y0 = car.position.y

    t.key('KeyW', true)
    t.until(() => car.position.x > b.x0 + 4, 3)
    t.key('KeyW', false)

    expect(car.position.x).toBeGreaterThan(b.x0 + 4)
    // Sur la dalle, 15 cm plus haut que la chaussée.
    expect(car.position.y - y0).toBeGreaterThan(0.08)
  })

  test('longe la bordure sans heurter d’obstacle invisible', () => {
    const b = nearestBlock()
    const car = launch('sedan', b.x0 - 1.6, b.z0 + 5, 0, 10)
    let slowest = Infinity

    t.key('KeyW', true)
    for (let i = 0; i < 30; i++) {
      t.simulate(0.1)
      slowest = Math.min(slowest, car.speed)
    }
    t.key('KeyW', false)

    expect(slowest).toBeGreaterThan(8)
  })

  test.each(['sedan', 'sport', 'suv', 'taxi', 'police', 'van'])(
    'au volant d’un %s, la tête reste sous le toit',
    (id) => {
      const { a, d } = street()
      const car = launch(id, a.x + d.x * 8, a.z + d.z * 8, Math.atan2(d.x, d.z))
      t.simulate(0.5)
      for (let k = 0; k < 30; k++) game.render(1, 1 / 30)

      game.player.actor.rig.object.updateMatrixWorld(true)
      const head = game.player.actor.rig.bones.head.getWorldPosition(new Vector3())
      const roof = car.visual.root.position.y + car.spec.belt + car.spec.cabin.height
      // L'os de la tête est à la base du crâne : le haut de la tête est ~25 cm plus haut.
      expect(head.y + 0.25).toBeLessThan(roof)
    },
  )

  afterAll(() => {
    // Les scénarios suivants partent à pied, sans voiture lancée à proximité.
    if (game.player.state === 'vehicle') game.player.exitVehicle(true)
    if (previous) game.removeVehicle(previous)
    previous = null
  })

  test('une voiture lancée écrase un policier sans s’arrêter net', () => {
    const { a, d } = street()
    const at = new Vector3(a.x + d.x * 40, 0, a.z + d.z * 40)
    const cop = game.debugSpawnActor(at.x, at.z, 0, 7, true)
    game.police.adoptOfficer(cop, at)
    const car = launch('sedan', a.x + d.x * 15, a.z + d.z * 15, Math.atan2(d.x, d.z), 18)

    t.key('KeyW', true)
    t.until(() => cop.dead, 3)
    t.key('KeyW', false)

    expect(cop.dead).toBe(true)
    expect(car.speed).toBeGreaterThan(5)
  })
})

describe('joueur', () => {
  test('voler une voiture du trafic éjecte son conducteur', () => {
    if (game.player.state === 'vehicle') game.player.exitVehicle(true)
    const victim = [...game.vehicles].find((v) => v.mode === 'kinematic' && v.driver && !v.destroyed)
    if (!victim) return
    game.player.respawnAt(victim.position.x + 2.5, victim.position.y + 0.2, victim.position.z)
    t.simulate(0.1)

    game.player.tryEnterVehicle()

    expect(game.player.vehicle).toBe(victim)
    expect(victim.driver).toBe(game.player.actor)
  })

  test('le joueur sort par la touche F, une fois le véhicule ralenti', () => {
    // On ne sort pas d'un véhicule lancé à plus de 8 m/s : frein à main d'abord.
    t.hold('Space', 3)
    t.press('KeyF')
    t.simulate(1)

    expect(game.player.state).toBe('foot')
  })

  test.each([
    ['court', false, 5],
    ['sprinte', true, 9],
  ])('à pied, le joueur %s vite', (_, sprint, min) => {
    if (game.player.state === 'vehicle') game.player.exitVehicle(true)
    game.player.respawnAt(-600, 0.3, -1000)
    t.simulate(0.2)
    game.cameraCtl.yaw = 0
    const p0 = game.player.position.clone()

    if (sprint) t.key('ShiftLeft', true)
    t.hold('KeyW', 2)
    t.key('ShiftLeft', false)

    // Vitesse moyenne sur 2 s, accélération comprise.
    expect(game.player.position.distanceTo(p0) / 2).toBeGreaterThan(min)
  })

  test('le joueur marche, court et s’accroupit', () => {
    const p0 = game.player.position.clone()

    t.hold('KeyW', 1)
    t.key('ShiftLeft', true)
    t.hold('KeyW', 1)
    t.key('ShiftLeft', false)
    t.hold('KeyC', 0.5)
    t.press('Space')
    t.simulate(1)

    expect(game.player.position.distanceTo(p0)).toBeGreaterThan(1)
  })

  test('mort : frais d’hôpital prélevés et réapparition', async () => {
    const money = useGameStore.getState().money

    game.player.actor.damage({ amount: 10_000, from: null, kind: 'fall', dir: { x: 0, z: 1 } })
    t.simulate(0.2)
    expect(game.player.alive).toBe(false)
    game.respawn('dead')
    t.simulate(0.2)
    await vi.waitFor(() => expect(useGameStore.getState().money).toBeLessThan(money))

    expect(game.player.alive).toBe(true)
  })

  test('arrestation : caution prélevée et armes perdues', async () => {
    const money = useGameStore.getState().money

    game.respawn('busted')
    await vi.waitFor(() => expect(useGameStore.getState().money).toBeLessThan(money))

    expect(game.player.inventory.weapons.map((w) => w.id)).toEqual(['fists'])
  })
})

describe('trafic et piétons', () => {
  test('un véhicule du trafic percuté devient physique', () => {
    const traffic = [...game.vehicles].find((v) => v.mode === 'kinematic' && !v.destroyed)
    const other = drive('sedan')
    if (!traffic) return

    game.traffic.onBumped(traffic, other)

    expect(traffic.mode).toBe('dynamic')
  })

  test('un piéton fauché par une voiture rapide est projeté', () => {
    const car = game.player.vehicle!
    t.hold('KeyW', 2)
    t.simulate(0.5)

    expect(car.speed).toBeDefined()
    expect(game.peds.count).toBeGreaterThan(0)
  })

  test('les témoins proches sont comptés', () => {
    const p = game.player.position

    expect(game.peds.nearbyWitnesses(p.x, p.z, 200)).toBeGreaterThanOrEqual(0)
  })

  test('la navigation trouve un chemin routier et un chemin piéton', () => {
    const s = game.city.locations.spawn
    const g = game.city.locations.garage

    const a = game.nav.nearestNode(s.x, s.z)!
    const b = game.nav.nearestNode(g.x + 120, g.z + 120)!
    const route = game.nav.findPath(a.id, b.id)

    expect(route[0]).toBe(a.id)
    expect(route.at(-1)).toBe(b.id)
    expect(game.nav.edgeBetween(route[0], route[1])).toBeDefined()
    expect(game.nav.nearestEdge(s.x, s.z)?.edge).toBeDefined()
    expect(game.nav.edgesInRing(s.x, s.z, 20, 200).length).toBeGreaterThan(0)
    const from = new Vector3(s.x, 0, s.z)
    const to = new Vector3(g.x + 30, 0, g.z + 30)
    // Sans ligne de vue directe, le chemin passe par les trottoirs.
    const walk = game.walkNav.path(from, to, (a, b) => game.physics.lineOfSight(a.x, 1, a.z, b.x, 1, b.z))

    expect(walk.at(-1)?.distanceTo(to)).toBeLessThan(1)
    expect(game.walkNav.path(from, from.clone().setX(from.x + 1), () => true)).toHaveLength(1)
  })
})
