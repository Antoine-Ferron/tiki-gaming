// @vitest-environment jsdom
import { beforeAll, describe, expect, test } from 'vitest'
import { Group, Vector3 } from 'three'
import { EventBus, type GameEvents } from '../core/events'
import { Rng } from '../core/rng'
import { anything } from '../game/testing/harness'
import { loadWeaponDefs, type WeaponDef, type WeaponId } from '../systems/weapons'
import weapons from '../systems/fixtures/weapons.json'
import type { Game } from '../game/Game'

// Les textures dessinées au canvas sont créées dès l'import des modules du rendu.
HTMLCanvasElement.prototype.getContext = (() => anything()) as unknown as HTMLCanvasElement['getContext']
const { Actor } = await import('./Actor')
const { randomLook } = await import('../procgen/character/characterModel')

/** Juste ce dont un personnage a besoin : une scène et le bus d'événements. */
function fakeGame() {
  const events = new EventBus<GameEvents>()
  const game = { root: new Group(), events, frame: 0 } as unknown as Game
  const killed: unknown[] = []
  const hurt: unknown[] = []
  events.on('actor:killed', (e) => killed.push(e))
  events.on('actor:hurt', (e) => hurt.push(e))
  return { game, killed, hurt }
}

function actor(game: Game) {
  return new Actor(game, randomLook(new Rng(7)), 'civilian', 0, 0, 0)
}

beforeAll(() => loadWeaponDefs(weapons as unknown as Record<WeaponId, WeaponDef>))

describe('dégâts', () => {
  test('sans armure, la santé baisse du montant reçu et un événement « blessé » part', () => {
    const { game, hurt, killed } = fakeGame()
    const a = actor(game)

    const killedNow = a.damage({ amount: 30, kind: 'bullet' })

    expect(killedNow).toBe(false)
    expect(a.health).toBe(70)
    expect(hurt).toHaveLength(1)
    expect(killed).toHaveLength(0)
  })

  test.each([
    ['balle', 'bullet', 40, 88, 12],
    ['explosion', 'explosion', 40, 88, 12],
    ['noyade : l’armure ne protège pas', 'drown', 40, 60, 40],
    ['chute : l’armure ne protège pas', 'fall', 40, 60, 40],
  ] as const)('armure de 40 contre 40 de dégâts (%s)', (_, kind, armor, health, armorLeft) => {
    const { game } = fakeGame()
    const a = actor(game)
    a.armor = armor

    a.damage({ amount: 40, kind })

    expect(a.health).toBeCloseTo(health)
    expect(a.armor).toBeCloseTo(armorLeft)
  })

  test('l’armure n’absorbe que ce qui lui reste', () => {
    const { game } = fakeGame()
    const a = actor(game)
    a.armor = 5

    a.damage({ amount: 50, kind: 'melee' })

    expect(a.armor).toBe(0)
    expect(a.health).toBe(55)
  })

  test('un coup mortel tue, prévient et oriente la chute à l’opposé du coup', () => {
    const { game, killed } = fakeGame()
    const a = actor(game)
    const deaths: string[] = []
    a.onDeath = (info) => deaths.push(info.kind)

    const killedNow = a.damage({ amount: 150, kind: 'bullet', dir: { x: 1, z: 0 } })

    expect(killedNow).toBe(true)
    expect(a.dead).toBe(true)
    expect(a.health).toBe(0)
    expect(deaths).toEqual(['bullet'])
    expect(killed).toHaveLength(1)
    expect(a.heading).toBeCloseTo(Math.atan2(-1, -0))
  })

  test('un mort ne reçoit plus de dégâts', () => {
    const { game, killed } = fakeGame()
    const a = actor(game)
    a.damage({ amount: 200, kind: 'fire' })

    expect(a.damage({ amount: 10, kind: 'bullet' })).toBe(false)
    expect(killed).toHaveLength(1)
  })
})

describe('arme tenue et posture', () => {
  test('changer d’arme met à jour la prise et ne reconstruit pas la même arme', () => {
    const { game } = fakeGame()
    const a = actor(game)

    a.setWeapon('rifle')
    const rifle = a.rig.bones.handR.children.length
    a.setWeapon('rifle')

    expect(a.weapon).toBe('rifle')
    expect(a.anim.holding).toBe('rifle')
    expect(a.rig.bones.handR.children.length).toBe(rifle)
  })

  test('les poings ne mettent rien dans la main', () => {
    const { game } = fakeGame()
    const a = actor(game)
    a.setWeapon('pistol')

    a.setWeapon('fists')

    expect(a.weapon).toBe('fists')
    expect(a.anim.holding).toBe(WEAPON_HOLDING('fists'))
  })

  test.each([
    ['debout', false, 1.35],
    ['accroupi', true, 0.8],
  ])('poitrine %s', (_, crouch, height) => {
    const { game } = fakeGame()
    const a = actor(game)
    a.anim.crouch = crouch

    expect(a.chest().y).toBeCloseTo(height)
  })
})

describe('rendu', () => {
  test('un personnage lointain est masqué, un proche est visible et projette son ombre', () => {
    const { game } = fakeGame()
    const near = actor(game)
    const far = actor(game)
    far.pushPosition(500, 0, 0)
    far.pushPosition(500, 0, 0)

    near.render(1, 1 / 60, new Vector3(0, 2, 5))
    far.render(1, 1 / 60, new Vector3(0, 2, 5))

    expect(near.rig.object.visible).toBe(true)
    expect(near.rig.mesh.castShadow).toBe(true)
    expect(far.rig.object.visible).toBe(false)
    expect(far.rig.mesh.castShadow).toBe(false)
  })

  test('le temps de mort avance pour l’animation de chute', () => {
    const { game } = fakeGame()
    const a = actor(game)
    a.damage({ amount: 200, kind: 'bullet' })

    a.render(1, 0.5, new Vector3(0, 2, 5))
    a.render(1, 0.5, new Vector3(0, 2, 90))

    expect(a.deadTime).toBeCloseTo(1)
    expect(a.anim.dead).toBeCloseTo(1)
  })

  test('assis dans un véhicule, la pose suit le siège', () => {
    const { game } = fakeGame()
    const a = actor(game)
    a.seatedIn = {}

    a.render(1, 1 / 60, new Vector3(0, 2, 5))

    expect(a.anim.seated).toBe(true)
  })
})

function WEAPON_HOLDING(id: WeaponId) {
  return (weapons as unknown as Record<WeaponId, WeaponDef>)[id].holding
}
