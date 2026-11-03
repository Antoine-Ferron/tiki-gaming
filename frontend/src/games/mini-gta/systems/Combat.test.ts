// @vitest-environment jsdom
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { Vector3 } from 'three'
import { Rng } from '../core/rng'
import { createTestGame, type TestGame } from '../game/testing/harness'
import { addWeapon, slotOf, WEAPONS, type WeaponId } from './weapons'

vi.mock('../net/api', () => import('../game/testing/fakeApi'))
// Simulations de plusieurs secondes : plus lentes quand toute la suite tourne en parallèle.
vi.setConfig({ testTimeout: 60_000 })

const { Actor } = await import('../entities/Actor')
const { CombatNpc } = await import('../entities/CombatNpc')
const { randomLook } = await import('../procgen/character/characterModel')

let t: TestGame
let game: TestGame['game']
/** Un point de chaussée près du départ et la direction de la rue : un couloir dégagé pour tirer. */
let road: Vector3
let along: Vector3
const noises: { radius: number; source: unknown }[] = []

const dummies: InstanceType<typeof CombatNpc>[] = []

/** Personnage immobile doté d'un collider, pour servir de cible (retiré après chaque test). */
function dummy(at: Vector3, faction: 'civilian' | 'police' = 'civilian') {
  const a = new Actor(game, randomLook(new Rng(3)), faction, at.x, at.y, at.z)
  dummies.push(new CombatNpc(game, a, 'fists'))
  game.debugActors.push(a)
  return a
}

/** Remet le joueur à pied sur la chaussée, sans recherche, arme et munitions données. */
function resetPlayer(weapon: WeaponId = 'fists', rounds = 0) {
  game.police.clear()
  const p = game.player
  p.respawnAt(road.x - along.x * 6, road.y, road.z - along.z * 6)
  p.inventory.weapons = [{ id: 'fists', clip: 0, ammo: 0 }]
  if (weapon !== 'fists') addWeapon(p.inventory, weapon, rounds)
  game.combat.select(weapon)
  // La caméra vise le long de la rue, depuis l'arrière du joueur.
  const eye = p.actor.position
    .clone()
    .addScaledVector(along, -3)
    .setY(road.y + 1.6)
  game.camera.position.copy(eye)
  game.camera.lookAt(eye.clone().add(along))
  game.camera.updateMatrixWorld()
  t.input.buttons = 0
  game.ui.blocking = false
  // Laisse retomber les délais entre deux tirs et les rechargements des tests précédents.
  t.simulate(1.5)
}

beforeAll(async () => {
  t = await createTestGame()
  game = t.game
  game.player.godMode = true
  const s = game.city.locations.spawn
  const hit = game.nav.nearestEdge(s.x, s.z, 200)!
  const g = game.city.roads.graph
  const pt = g.lanePoint(hit.edge, 1, 0, hit.edge.length * 0.5)
  road = new Vector3(pt.x, game.city.terrain.heightAt(pt.x, pt.z), pt.z)
  const d = g.direction(hit.edge, 1)
  along = new Vector3(d.x, 0, d.z).normalize()
  game.events.on('noise', (n) => noises.push({ radius: n.radius, source: n.source }))
}, 60_000)

afterAll(() => t?.dispose())

beforeEach(() => {
  noises.length = 0
})

afterEach(() => {
  for (const d of dummies.splice(0)) d.dispose()
  game.debugActors.length = 0
})

describe('tir instantané (hitscan)', () => {
  const pistol = () => WEAPONS.pistol

  test('une balle dans le corps blesse la cible du montant de l’arme', () => {
    const target = dummy(road)
    const origin = road
      .clone()
      .addScaledVector(along, -4)
      .setY(road.y + 1.1)

    const end = game.combat.hitscan(origin, along, pistol(), null, origin)

    expect(end).not.toBeNull()
    expect(target.health).toBeCloseTo(100 - pistol().damage)
  })

  test('une balle dans la tête fait 2,5 fois plus de dégâts', () => {
    const target = dummy(road.clone().addScaledVector(along, 1))
    const origin = target.position
      .clone()
      .addScaledVector(along, -4)
      .setY(target.position.y + 1.7)

    game.combat.hitscan(origin, along, pistol(), null, origin)

    expect(target.health).toBeCloseTo(Math.max(0, 100 - pistol().damage * 2.5))
  })

  test('au-delà de 60 % de la portée, les dégâts baissent de 30 %', () => {
    const target = dummy(road.clone().addScaledVector(along, 2))
    const origin = target.position
      .clone()
      .addScaledVector(along, -4)
      .setY(target.position.y + 1.1)

    game.combat.hitscan(origin, along, { ...pistol(), range: 5, damage: 20 }, null, origin)

    expect(target.health).toBeCloseTo(100 - 14)
  })

  test('une balle dans un véhicule l’abîme et retient le tireur', () => {
    const at = road.clone().addScaledVector(along, 3)
    const car = game.spawnVehicle('sedan', at.x, at.y + 0.4, at.z, Math.atan2(along.x, along.z), 'dynamic')
    t.simulate(0.3)
    const health = car.health
    const shooter = dummy(road.clone().addScaledVector(along, -10).setY(-50))
    const origin = car.position
      .clone()
      .addScaledVector(along, -8)
      .setY(car.position.y + 1)

    game.combat.hitscan(origin, along, pistol(), shooter, origin)

    expect(car.health).toBeLessThan(health)
    expect(car.lastAttacker).toBe(shooter)
    game.removeVehicle(car)
  })

  test('une balle tirée vers le ciel ne touche rien', () => {
    const origin = road.clone().setY(road.y + 1)

    expect(game.combat.hitscan(origin, new Vector3(0, 1, 0), pistol(), null, origin)).toBeNull()
  })

  test('une balle tirée vers le sol s’arrête sur la chaussée', () => {
    const origin = road.clone().setY(road.y + 5)

    const end = game.combat.hitscan(origin, new Vector3(0, -1, 0), pistol(), null, origin)

    expect(end?.y).toBeCloseTo(road.y, 0)
  })

  test('une bouche d’incendie ou une poubelle touchée est renversée', () => {
    const p = game.player.position
    game.world.update(0, p, p, 0)
    const prop = game.city.props.find(
      (q) => (q.kind === 'hydrant' || q.kind === 'bin') && !q.destroyed && Math.hypot(q.x - p.x, q.z - p.z) < 250,
    )!
    const origin = new Vector3(prop.x, prop.y + 6, prop.z)

    game.combat.hitscan(origin, new Vector3(0, -1, 0), pistol(), null, origin)

    expect(prop.destroyed).toBe(true)
  })
})

describe('tirs des PNJ', () => {
  test('un PNJ précis touche le joueur et fait du bruit', () => {
    resetPlayer()
    game.player.godMode = false
    const shooter = dummy(game.player.position.clone().addScaledVector(along, 5), 'police')
    const before = game.player.actor.health

    for (let i = 0; i < 5; i++) game.combat.npcFire(shooter, game.player.actor.chest(), 1, 'pistol')

    expect(game.player.actor.health).toBeLessThan(before)
    expect(noises.some((n) => n.source === shooter)).toBe(true)
    game.player.godMode = true
    game.player.actor.health = game.player.actor.maxHealth
  })
})

describe('corps à corps', () => {
  test('un coup de poing blesse la cible juste devant et fait du bruit', () => {
    const attacker = dummy(road.clone().addScaledVector(along, 20))
    attacker.heading = Math.atan2(along.x, along.z)
    const target = dummy(attacker.position.clone().addScaledVector(along, 1))

    game.combat.melee(attacker, WEAPONS.fists)

    expect(target.health).toBeCloseTo(100 - WEAPONS.fists.damage)
    expect(noises.some((n) => n.radius === 15)).toBe(true)
  })

  test('un coup dans le vide ne fait pas de bruit', () => {
    const attacker = dummy(
      road
        .clone()
        .addScaledVector(along, 30)
        .setY(road.y + 40),
    )

    game.combat.melee(attacker, WEAPONS.bat)

    expect(noises).toHaveLength(0)
  })

  test('frapper un véhicule l’abîme', () => {
    const at = road.clone().addScaledVector(along, -25)
    const car = game.spawnVehicle('sedan', at.x, at.y + 0.4, at.z, Math.atan2(along.x, along.z), 'dynamic')
    t.simulate(0.2)
    const attacker = dummy(car.position.clone().addScaledVector(along, -2.9))
    attacker.heading = Math.atan2(along.x, along.z)
    const health = car.health

    game.combat.melee(attacker, WEAPONS.bat)

    expect(car.health).toBeLessThan(health)
    game.removeVehicle(car)
  })
})

describe('explosions et grenades', () => {
  test('les dégâts décroissent avec la distance et épargnent ceux qui sont hors de portée', () => {
    const c = road.clone().addScaledVector(along, 40)
    const near = dummy(c.clone().addScaledVector(along, 1))
    const mid = dummy(c.clone().addScaledVector(along, 4))
    const far = dummy(c.clone().addScaledVector(along, 12))

    game.combat.explosion(c.x, c.y + 0.5, c.z, 8, 50, null)

    expect(near.health).toBeLessThan(mid.health)
    expect(mid.health).toBeLessThan(100)
    expect(far.health).toBe(100)
    expect(noises.some((n) => n.radius === 180)).toBe(true)
  })

  test('un mort n’est plus touché par une explosion', () => {
    const c = road.clone().addScaledVector(along, 50)
    const corpse = dummy(c)
    corpse.damage({ amount: 500, kind: 'bullet' })
    const hurt = vi.fn()
    const off = game.events.on('actor:hurt', hurt)

    game.combat.explosion(c.x, c.y + 0.5, c.z, 8, 50, null)

    expect(hurt).not.toHaveBeenCalledWith(expect.objectContaining({ actor: corpse }))
    off?.()
  })

  test('une voiture du trafic soufflée devient physique et est endommagée', () => {
    const c = road.clone().addScaledVector(along, -40)
    const car = game.spawnVehicle('sedan', c.x, c.y + 0.4, c.z, 0, 'kinematic')
    const health = car.health

    game.combat.explosion(c.x + 1, c.y + 0.5, c.z, 8, 50, null)

    expect(car.mode).toBe('dynamic')
    expect(car.health).toBeLessThan(health)
    game.removeVehicle(car)
  })

  test('une grenade lancée explose après sa mèche', () => {
    resetPlayer()

    game.combat.throwGrenade(game.player.actor)
    t.simulate(1)
    const early = noises.filter((n) => n.radius === 180).length
    t.simulate(2.5)

    expect(early).toBe(0)
    expect(noises.some((n) => n.radius === 180 && n.source === game.player.actor)).toBe(true)
  })
})

describe('armes du joueur', () => {
  const ammo = () => {
    const s = slotOf(game.player.inventory, game.player.inventory.current)!
    return s.clip + s.ammo
  }

  test('les touches 1 à 7 choisissent une arme possédée et ignorent les autres', () => {
    resetPlayer('pistol', 36)
    game.combat.select('fists')

    t.press('Digit3')
    t.simulate(0.05)
    expect(game.player.inventory.current).toBe('pistol')

    t.press('Digit5')
    t.simulate(0.05)
    expect(game.player.inventory.current).toBe('pistol')
  })

  test('la molette fait défiler les armes à pied', () => {
    resetPlayer('pistol', 36)
    game.combat.select('fists')
    t.input.pointerLocked = true

    window.dispatchEvent(new WheelEvent('wheel', { deltaY: 1 }))
    t.simulate(0.05)

    expect(game.player.inventory.current).toBe('pistol')
    t.input.pointerLocked = false
  })

  test('un tir au pistolet consomme une balle, fait du bruit et ne se répète pas en gardant la gâchette', () => {
    resetPlayer('pistol', 36)
    const before = ammo()

    t.input.buttons = 1
    t.simulate(1)
    t.input.buttons = 0

    expect(ammo()).toBe(before - 1)
    expect(game.combat.recentlyFired).toBe(true)
    expect(noises.some((n) => n.source === game.player.actor)).toBe(true)
  })

  test('un tir fait reculer la caméra, qui revient ensuite', () => {
    resetPlayer('pistol', 36)
    t.input.buttons = 1
    t.simulate(0.05)
    t.input.buttons = 0
    const pitch = game.cameraCtl.pitch
    expect(game.combat.recoil).toBeGreaterThan(0)

    for (let i = 0; i < 20; i++) game.combat.render()

    expect(game.cameraCtl.pitch).toBeLessThan(pitch)
    expect(game.combat.recoil).toBe(0)
  })

  test('le chargeur vide déclenche le rechargement, qui le remplit', () => {
    resetPlayer('pistol', 36)
    const slot = slotOf(game.player.inventory, 'pistol')!
    slot.clip = 1

    t.input.buttons = 1
    t.simulate(0.05)
    t.input.buttons = 0
    expect(game.combat.isReloading).toBe(true)
    t.simulate(WEAPONS.pistol.reload + 0.2)

    expect(game.combat.isReloading).toBe(false)
    expect(slot.clip).toBe(WEAPONS.pistol.magazine)
  })

  test.each([
    ['chargeur entamé : recharge', 5, true],
    ['chargeur plein : rien à faire', -1, false],
  ])('touche R, %s', (_, clip, reloads) => {
    resetPlayer('pistol', 36)
    const slot = slotOf(game.player.inventory, 'pistol')!
    if (clip >= 0) slot.clip = clip

    t.press('KeyR')
    t.simulate(0.05)

    expect(game.combat.isReloading).toBe(reloads)
  })

  test('sans munitions, la gâchette ne tire pas', () => {
    resetPlayer('pistol', 36)
    const slot = slotOf(game.player.inventory, 'pistol')!
    slot.clip = 0
    slot.ammo = 0

    t.input.buttons = 1
    t.simulate(0.2)
    t.input.buttons = 0

    expect(game.combat.recentlyFired).toBe(false)
    expect(game.combat.isReloading).toBe(false)
  })

  test('aux poings, la gâchette donne un coup animé', () => {
    resetPlayer()

    t.input.buttons = 1
    t.simulate(0.1)
    t.input.buttons = 0

    expect(game.player.actor.anim.attack).toBeGreaterThan(0)
    t.simulate(1)
    expect(game.player.actor.anim.attack).toBe(0)
  })

  test('la dernière grenade lancée remet les poings', () => {
    resetPlayer('grenade', 1)

    t.input.buttons = 1
    t.simulate(0.05)
    t.input.buttons = 0

    expect(game.player.inventory.current).toBe('fists')
    t.simulate(3)
  })

  test('menu ouvert : aucune action d’arme', () => {
    resetPlayer('pistol', 36)
    const before = ammo()
    game.ui.blocking = true

    t.input.buttons = 1
    t.simulate(0.3)
    t.input.buttons = 0
    game.ui.blocking = false

    expect(ammo()).toBe(before)
  })

  test.each([
    ['fusil d’assaut : pas de tir en voiture', 'rifle' as WeaponId, 3, false],
    ['pistolet sans viser : pas de tir', 'pistol' as WeaponId, 1, false],
    ['pistolet en visant : tir depuis la voiture', 'pistol' as WeaponId, 3, true],
  ])('en voiture, %s', (_, weapon, buttons, fires) => {
    resetPlayer(weapon, 90)
    const at = game.player.position.clone()
    const car = game.spawnVehicle('sedan', at.x + 3, at.y + 0.4, at.z, 0, 'dynamic')
    t.simulate(0.2)
    game.player.respawnAt(car.position.x + 2.5, car.position.y, car.position.z)
    game.player.tryEnterVehicle()
    t.simulate(0.1)
    const before = ammo()

    t.input.buttons = buttons
    t.simulate(0.1)
    t.input.buttons = 0

    expect(game.player.state).toBe('vehicle')
    expect(ammo() < before).toBe(fires)
    game.player.exitVehicle(true)
    game.removeVehicle(car)
  })
})

test('dispose retire les grenades en vol', () => {
  resetPlayer()
  game.combat.throwGrenade(game.player.actor)

  game.combat.dispose()
  t.simulate(3)

  expect(noises.some((n) => n.radius === 180)).toBe(false)
})
