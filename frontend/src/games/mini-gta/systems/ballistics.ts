import type { WeaponDef } from './weapons'

/**
 * Balistique (logique pure) : zone touchée, chute des dégâts avec la distance, dispersion du tir et recul.
 * Les caractéristiques des armes viennent du serveur ; ces règles en dérivent leurs paramètres.
 */

export type HitZone = 'head' | 'torso' | 'limb'

/** Demi-largeur du torse (m) : un impact plus écarté de l'axe du corps touche un bras. */
const TORSO_HALF_WIDTH = 0.24

/**
 * Zone touchée d'après la hauteur de l'impact au-dessus des pieds et son écart latéral à l'axe du corps.
 * Accroupi, le corps est plus ramassé (tête vers 1,1 m au lieu de 1,5 m).
 */
export function hitZone(height: number, side: number, crouching: boolean): HitZone {
  const k = crouching ? 0.72 : 1
  if (height > 1.5 * k) return 'head'
  if (height < 0.85 * k) return 'limb'
  return Math.abs(side) > TORSO_HALF_WIDTH ? 'limb' : 'torso'
}

/** Multiplicateur de dégâts de la zone ; une arme lourde à un coup est plus létale à la tête. */
export function zoneMultiplier(zone: HitZone, def: WeaponDef): number {
  if (zone === 'head') return def.damage >= 100 ? 4 : 3.2
  if (zone === 'limb') return 0.6
  return 1
}

/**
 * Facteur de dégâts selon la distance : plein jusqu'au quart de la portée, puis décroissance linéaire jusqu'à un
 * plancher atteint à la portée. Les plombs se dispersent (plancher bas), les armes longues portent loin.
 */
export function damageFalloff(def: WeaponDef, distance: number): number {
  const floor = def.pellets > 1 ? 0.15 : Math.min(0.95, 0.5 + 0.45 * Math.min(1, Math.max(0, (def.range - 100) / 300)))
  const start = def.range * 0.25
  const t = Math.min(1, Math.max(0, (distance - start) / (def.range - start)))
  return 1 - (1 - floor) * t
}

export interface ShooterStance {
  aiming: boolean
  crouching: boolean
  moving: boolean
  sprinting: boolean
  airborne: boolean
}

/** Demi-angle (rad) du cône de tir : précision de l'arme, posture, mouvement, plus la dispersion accumulée. */
export function shotSpread(def: WeaponDef, s: ShooterStance, bloom: number): number {
  let k = s.aiming ? 1 : 2.5
  if (s.crouching) k *= 0.65
  if (s.sprinting) k *= 2.4
  else if (s.moving) k *= 1.5
  if (s.airborne) k *= 3
  // Plancher : même un sniper immobile n'est pas parfaitement précis sans viser.
  return Math.max(def.spread, 0.002) * k + bloom
}

/** Dispersion accumulée par les tirs rapprochés, qui se résorbe entre deux tirs. */
export class Bloom {
  value = 0

  /** Un tir : la dispersion grandit (davantage pour une arme lente et puissante). */
  fire(def: WeaponDef) {
    const add = Math.max(def.spread, 0.004) * (def.auto ? 0.45 : 1.2)
    this.value = Math.min(0.15, this.value + add)
  }

  /** Résorption : demi-vie d'environ deux intervalles de tir. */
  recover(def: WeaponDef, dt: number) {
    const halfLife = Math.max(0.12, def.interval * 2)
    this.value *= Math.pow(0.5, dt / halfLife)
    if (this.value < 1e-5) this.value = 0
  }
}

/**
 * Recul d'un tir (rad) : vertical, proportionnel à la puissance de l'arme, qui s'accentue au fil d'une rafale ;
 * horizontal léger et aléatoire. `shotInBurst` compte les tirs rapprochés (0 = premier).
 */
export function recoilKick(def: WeaponDef, shotInBurst: number, random = Math.random): { pitch: number; yaw: number } {
  const power = def.damage * def.pellets
  const base = Math.min(0.12, 0.004 + power * 0.00085)
  const climb = def.auto ? 1 + Math.min(shotInBurst, 10) * 0.12 : 1
  const pitch = base * climb
  const yaw = (random() - 0.5) * pitch * (def.auto ? 0.8 : 0.4)
  return { pitch, yaw }
}
