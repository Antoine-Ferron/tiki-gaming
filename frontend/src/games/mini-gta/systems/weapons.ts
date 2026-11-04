import type { Holding } from '../procgen/character/animator'

export type WeaponId = 'fists' | 'bat' | 'pistol' | 'rifle' | 'shotgun' | 'sniper' | 'grenade'

export interface WeaponDef {
  id: WeaponId
  label: string
  slot: number
  holding: Holding
  damage: number
  /** Seconds between shots. */
  interval: number
  magazine: number
  reload: number
  auto: boolean
  /** Cone half-angle (rad) when aiming. */
  spread: number
  range: number
  pellets: number
  /** Camera FOV while aiming. */
  zoomFov: number
  melee?: boolean
  thrown?: boolean
  price: number
  ammoPrice: number
  ammoPack: number
  /** Noise radius (peds panic, police hear). */
  noise: number
}

/**
 * Caractéristiques et prix des armes, fournis par le backend (`GET /api/weapons`) au démarrage
 * via `loadWeaponDefs`. Le serveur fait autorité, notamment sur les prix.
 */
export const WEAPONS = {} as Record<WeaponId, WeaponDef>

export function loadWeaponDefs(defs: Record<WeaponId, WeaponDef>) {
  for (const id of WEAPON_ORDER) {
    if (!defs[id]) throw new Error(`Arme manquante dans la réponse du serveur : ${id}`)
    WEAPONS[id] = defs[id]
  }
}

export const WEAPON_ORDER: WeaponId[] = ['fists', 'bat', 'pistol', 'shotgun', 'rifle', 'sniper', 'grenade']

/** Owned weapon state. `ammo` is the reserve, `clip` the loaded magazine. */
export interface WeaponSlot {
  id: WeaponId
  clip: number
  ammo: number
}

export interface Inventory {
  weapons: WeaponSlot[]
  current: WeaponId
}

export function createInventory(): Inventory {
  return {
    weapons: [
      { id: 'fists', clip: 0, ammo: 0 },
      { id: 'pistol', clip: 12, ammo: 48 },
    ],
    current: 'fists',
  }
}

export function slotOf(inv: Inventory, id: WeaponId) {
  return inv.weapons.find((w) => w.id === id)
}

/** Fire one shot if possible. Returns true when a shot was consumed. Pure logic (testable). */
export function consumeShot(inv: Inventory): boolean {
  const def = WEAPONS[inv.current]
  if (def.melee) return true
  const slot = slotOf(inv, inv.current)
  if (!slot) return false
  if (def.thrown) {
    if (slot.ammo <= 0) return false
    slot.ammo--
    return true
  }
  if (slot.clip <= 0) return false
  slot.clip--
  return true
}

/** Refill the magazine from the reserve. Returns rounds moved. */
export function reload(inv: Inventory): number {
  const def = WEAPONS[inv.current]
  const slot = slotOf(inv, inv.current)
  if (!slot || def.melee || def.thrown) return 0
  const need = def.magazine - slot.clip
  const moved = Math.min(need, slot.ammo)
  slot.clip += moved
  slot.ammo -= moved
  return moved
}

export function addWeapon(inv: Inventory, id: WeaponId, rounds: number) {
  const def = WEAPONS[id]
  let slot = slotOf(inv, id)
  if (!slot) {
    slot = { id, clip: 0, ammo: 0 }
    inv.weapons.push(slot)
    inv.weapons.sort((a, b) => WEAPONS[a.id].slot - WEAPONS[b.id].slot)
  }
  if (def.thrown) slot.ammo += rounds
  else {
    slot.ammo += rounds
    if (slot.clip === 0) {
      const moved = Math.min(def.magazine, slot.ammo)
      slot.clip = moved
      slot.ammo -= moved
    }
  }
}

export function cycleWeapon(inv: Inventory, dir: 1 | -1): WeaponId {
  const owned = inv.weapons.map((w) => w.id)
  const i = owned.indexOf(inv.current)
  inv.current = owned[(i + dir + owned.length) % owned.length]
  return inv.current
}
