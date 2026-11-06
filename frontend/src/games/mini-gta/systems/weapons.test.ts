import { beforeAll, describe, expect, it } from 'vitest'
import {
  addWeapon,
  consumeShot,
  createInventory,
  cycleWeapon,
  loadWeaponDefs,
  reload,
  slotOf,
  WEAPONS,
  type WeaponDef,
  type WeaponId,
} from './weapons'
// Instantané de GET /api/weapons : les caractéristiques des armes viennent du backend.
import defs from './fixtures/weapons.json'

beforeAll(() => loadWeaponDefs(defs as Record<WeaponId, WeaponDef>))

/** Inventaire de départ auquel on ajoute un pistolet chargé (12 + 48), comme après un achat à l'armurerie. */
function withPistol() {
  const inv = createInventory()
  if (!slotOf(inv, 'pistol')) addWeapon(inv, 'pistol', 60)
  return inv
}

describe('weapons', () => {
  it('starts with fists only, as a new game (R2)', () => {
    const inv = createInventory()
    expect(inv.current).toBe('fists')
    expect(inv.weapons).toEqual([{ id: 'fists', clip: 0, ammo: 0 }])
  })

  it('consumes the magazine then refuses to fire', () => {
    const inv = withPistol()
    inv.current = 'pistol'
    for (let i = 0; i < 12; i++) expect(consumeShot(inv)).toBe(true)
    expect(consumeShot(inv)).toBe(false)
  })

  it('reloads from the reserve without exceeding the magazine', () => {
    const inv = withPistol()
    inv.current = 'pistol'
    for (let i = 0; i < 5; i++) consumeShot(inv)
    expect(reload(inv)).toBe(5)
    expect(slotOf(inv, 'pistol')).toEqual({ id: 'pistol', clip: 12, ammo: 43 })
  })

  it('melee always fires and never reloads', () => {
    const inv = createInventory()
    expect(consumeShot(inv)).toBe(true)
    expect(reload(inv)).toBe(0)
  })

  it('adds new weapons sorted by slot and loads the first magazine', () => {
    const inv = withPistol()
    addWeapon(inv, 'rifle', 90)
    addWeapon(inv, 'bat', 0)
    expect(inv.weapons.map((w) => w.id)).toEqual(['fists', 'bat', 'pistol', 'rifle'])
    expect(slotOf(inv, 'rifle')).toEqual({ id: 'rifle', clip: WEAPONS.rifle.magazine, ammo: 60 })
  })

  it('grenades use the reserve directly', () => {
    const inv = createInventory()
    addWeapon(inv, 'grenade', 2)
    inv.current = 'grenade'
    expect(consumeShot(inv)).toBe(true)
    expect(consumeShot(inv)).toBe(true)
    expect(consumeShot(inv)).toBe(false)
  })

  it('cycles through owned weapons in both directions', () => {
    const inv = withPistol()
    expect(cycleWeapon(inv, 1)).toBe('pistol')
    expect(cycleWeapon(inv, 1)).toBe('fists')
    expect(cycleWeapon(inv, -1)).toBe('pistol')
  })
})

describe('loadWeaponDefs', () => {
  it('refuse une réponse incomplète du serveur', () => {
    const partial: Partial<Record<WeaponId, WeaponDef>> = { ...(defs as Record<WeaponId, WeaponDef>) }
    delete partial.sniper
    expect(() => loadWeaponDefs(partial as Record<WeaponId, WeaponDef>)).toThrow(/sniper/)
  })
})
