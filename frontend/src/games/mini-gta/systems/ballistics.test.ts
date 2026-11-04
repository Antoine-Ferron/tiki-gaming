import { describe, expect, test } from 'vitest'
import { Bloom, damageFalloff, hitZone, recoilKick, shotSpread, zoneMultiplier, type ShooterStance } from './ballistics'
import type { WeaponDef } from './weapons'
import defs from './fixtures/weapons.json'

const W = defs as unknown as Record<string, WeaponDef>
const still: ShooterStance = { aiming: true, crouching: false, moving: false, sprinting: false, airborne: false }

describe('zone touchée', () => {
  test.each([
    ['tête', 1.65, 0, 'head'],
    ['haut du torse', 1.35, 0.1, 'torso'],
    ['bas du torse', 0.95, 0, 'torso'],
    ['jambes', 0.5, 0, 'limb'],
    ['bras (sur le côté du torse)', 1.2, 0.3, 'limb'],
  ])('%s', (_, height, side, zone) => {
    expect(hitZone(height, side, false)).toBe(zone)
  })

  test('accroupi, la tête est plus bas', () => {
    expect(hitZone(1.2, 0, true)).toBe('head')
    expect(hitZone(1.2, 0, false)).toBe('torso')
  })

  test('la tête multiplie fortement les dégâts, les membres les réduisent', () => {
    expect(zoneMultiplier('head', W.pistol)).toBeGreaterThanOrEqual(3)
    expect(zoneMultiplier('torso', W.pistol)).toBe(1)
    expect(zoneMultiplier('limb', W.pistol)).toBeLessThan(1)
    // Le sniper tue à la tête quel que soit le gilet.
    expect(W.sniper.damage * zoneMultiplier('head', W.sniper)).toBeGreaterThan(300)
  })
})

describe('chute de dégâts', () => {
  test('pleine puissance à courte distance, décroissance progressive ensuite', () => {
    const near = damageFalloff(W.rifle, 5)
    const mid = damageFalloff(W.rifle, 90)
    const far = damageFalloff(W.rifle, 175)

    expect(near).toBe(1)
    expect(mid).toBeLessThan(near)
    expect(far).toBeLessThan(mid)
    expect(far).toBeGreaterThan(0)
  })

  test('le fusil à pompe s’effondre avec la distance, le sniper presque pas', () => {
    expect(damageFalloff(W.shotgun, 40)).toBeLessThan(0.35)
    expect(damageFalloff(W.sniper, 400)).toBeGreaterThan(0.85)
  })
})

describe('dispersion', () => {
  test('viser, s’accroupir et rester immobile resserrent le tir', () => {
    const base = shotSpread(W.rifle, still, 0)

    expect(shotSpread(W.rifle, { ...still, aiming: false }, 0)).toBeGreaterThan(base)
    expect(shotSpread(W.rifle, { ...still, crouching: true }, 0)).toBeLessThan(base)
    expect(shotSpread(W.rifle, { ...still, moving: true }, 0)).toBeGreaterThan(base)
    expect(shotSpread(W.rifle, { ...still, sprinting: true }, 0)).toBeGreaterThan(
      shotSpread(W.rifle, { ...still, moving: true }, 0),
    )
    expect(shotSpread(W.rifle, { ...still, airborne: true }, 0)).toBeGreaterThan(base)
  })

  test('la dispersion grandit à chaque tir puis se résorbe', () => {
    const bloom = new Bloom()
    for (let i = 0; i < 6; i++) bloom.fire(W.rifle)
    const afterBurst = bloom.value

    bloom.recover(W.rifle, 1)

    expect(afterBurst).toBeGreaterThan(0)
    expect(bloom.value).toBeLessThan(afterBurst * 0.2)
    expect(shotSpread(W.rifle, still, afterBurst)).toBeGreaterThan(shotSpread(W.rifle, still, 0))
  })

  test('la dispersion est plafonnée', () => {
    const bloom = new Bloom()
    for (let i = 0; i < 200; i++) bloom.fire(W.rifle)

    expect(bloom.value).toBeLessThan(0.2)
  })
})

describe('recul', () => {
  test('le sniper et le fusil à pompe reculent plus que le pistolet', () => {
    expect(recoilKick(W.sniper, 0).pitch).toBeGreaterThan(recoilKick(W.pistol, 0).pitch)
    expect(recoilKick(W.shotgun, 0).pitch).toBeGreaterThan(recoilKick(W.pistol, 0).pitch)
  })

  test('en rafale, le fusil d’assaut monte de plus en plus', () => {
    expect(recoilKick(W.rifle, 6).pitch).toBeGreaterThan(recoilKick(W.rifle, 0).pitch)
  })

  test('le recul horizontal reste léger', () => {
    for (let i = 0; i < 20; i++) {
      const k = recoilKick(W.rifle, i)
      expect(Math.abs(k.yaw)).toBeLessThanOrEqual(k.pitch * 0.5)
    }
  })
})
