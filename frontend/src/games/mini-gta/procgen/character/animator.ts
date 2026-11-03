/* v8 ignore file -- rendu visuel (WebGL, shaders, géométries, canvas) : vérifié à l'écran, sans règle de jeu. Voir docs/games/mini-gta/regles.md § 6. */
import { clamp, damp } from '../../core/math'
import type { BoneName, CharacterRig } from './characterModel'

export type Holding = 'none' | 'pistol' | 'rifle' | 'melee' | 'throw'

/** Inputs for the procedural animation, set by the character's controller each frame. */
export interface AnimState {
  /** Horizontal speed (m/s). */
  speed: number
  grounded: boolean
  aiming: boolean
  /** Vertical aim angle (rad, + = up). */
  aimPitch: number
  holding: Holding
  /** 0..1 progress of a punch / swing / throw (0 = idle). */
  attack: number
  crouch: boolean
  seated: boolean
  /** 0 = alive, >0 = seconds since death. */
  dead: number
  /** Hands raised (surrender / cower). */
  handsUp: boolean
}

export function defaultAnimState(): AnimState {
  return {
    speed: 0,
    grounded: true,
    aiming: false,
    aimPitch: 0,
    holding: 'none',
    attack: 0,
    crouch: false,
    seated: false,
    dead: 0,
    handsUp: false,
  }
}

type Rot = [number, number, number]

/** Drives bone rotations procedurally; no animation clips needed. */
export class CharacterAnimator {
  private phase = Math.random() * Math.PI * 2
  private time = Math.random() * 10
  private current = new Map<BoneName, Rot>()
  private hipsY: number
  private deathSide = Math.random() < 0.5 ? 1 : -1

  constructor(private rig: CharacterRig) {
    this.hipsY = rig.rest.hips[1]
  }

  update(dt: number, s: AnimState) {
    this.time += dt
    const stride = 1.3 + clamp((s.speed - 2) / 4, 0, 1) * 1.1
    this.phase += (s.speed / stride) * Math.PI * dt
    const ph = this.phase
    const walk = clamp(s.speed / 1.4, 0, 1)
    const run = clamp((s.speed - 2.6) / 3, 0, 1)
    const t: Partial<Record<BoneName, Rot>> = {}
    let hips = this.hipsY
    let rootX = 0
    let rootY = 0
    let rootZ = 0

    const sw = Math.sin(ph)
    const legAmp = (0.45 + 0.4 * run) * walk
    t.thighL = [-sw * legAmp, 0, 0]
    t.thighR = [sw * legAmp, 0, 0]
    const kneeL = Math.max(0, Math.sin(ph + 1.3)) * (0.4 + 1.0 * run) * walk + 0.05
    const kneeR = Math.max(0, Math.sin(ph + Math.PI + 1.3)) * (0.4 + 1.0 * run) * walk + 0.05
    t.shinL = [kneeL, 0, 0]
    t.shinR = [kneeR, 0, 0]
    t.footL = [-kneeL * 0.3, 0, 0]
    t.footR = [-kneeR * 0.3, 0, 0]
    const armAmp = (0.35 + 0.5 * run) * walk
    t.upperArmL = [sw * armAmp, 0, 0.08]
    t.upperArmR = [-sw * armAmp, 0, -0.08]
    t.foreArmL = [-0.15 - 0.9 * run, 0, 0]
    t.foreArmR = [-0.15 - 0.9 * run, 0, 0]
    t.spine = [0.05 + 0.18 * run, Math.sin(ph) * 0.06 * walk, 0]
    t.chest = [Math.sin(this.time * 1.8) * 0.02, -Math.sin(ph) * 0.1 * walk, 0]
    t.head = [0, 0, 0]
    hips += -Math.abs(Math.cos(ph)) * (0.03 + 0.05 * run) * walk

    if (!s.grounded) {
      t.thighL = [-0.7, 0, 0]
      t.thighR = [-0.2, 0, 0]
      t.shinL = [1.1, 0, 0]
      t.shinR = [0.6, 0, 0]
      t.upperArmL = [-0.6, 0, 0.5]
      t.upperArmR = [-0.6, 0, -0.5]
    }

    if (s.crouch) {
      hips = this.hipsY * 0.6
      t.thighL = [-1.4, 0, 0.1]
      t.thighR = [-1.4, 0, -0.1]
      t.shinL = [2.2, 0, 0]
      t.shinR = [2.2, 0, 0]
      t.footL = [-0.8, 0, 0]
      t.footR = [-0.8, 0, 0]
      t.spine = [0.4, 0, 0]
    }

    if (s.handsUp) {
      t.upperArmL = [-2.6, 0, 0.4]
      t.upperArmR = [-2.6, 0, -0.4]
      t.foreArmL = [-0.6, 0, 0]
      t.foreArmR = [-0.6, 0, 0]
      if (s.crouch) t.head = [0.5, 0, 0]
    }

    // Upper body: weapons
    const pitch = s.aimPitch
    if (s.holding === 'pistol' && s.aiming) {
      t.upperArmR = [-Math.PI / 2 - pitch, 0, 0.12]
      t.foreArmR = [0, 0, 0]
      t.upperArmL = [-Math.PI / 2 - pitch + 0.1, 0, -0.55]
      t.foreArmL = [-0.25, 0, 0]
      t.head = [-pitch * 0.5, 0, 0]
    } else if (s.holding === 'rifle') {
      if (s.aiming) {
        t.upperArmR = [-1.3 - pitch, 0, 0.35]
        t.foreArmR = [-0.5, 0, 0]
        t.upperArmL = [-1.45 - pitch, 0, -0.55]
        t.foreArmL = [-0.15, 0, 0]
        t.head = [-pitch * 0.5, 0, 0]
      } else {
        t.upperArmR = [-0.5, 0, 0.25]
        t.foreArmR = [-1.0, 0, 0]
        t.upperArmL = [-0.8, 0, -0.45]
        t.foreArmL = [-0.9, 0, 0]
      }
    } else if (s.holding === 'melee' && s.aiming) {
      t.upperArmR = [-2.2, 0, 0.4]
      t.foreArmR = [-0.8, 0, 0]
    } else if (s.holding === 'none' && s.aiming) {
      // Fists up
      t.upperArmR = [-0.9, 0, 0.3]
      t.foreArmR = [-1.9, 0, 0]
      t.upperArmL = [-0.9, 0, -0.3]
      t.foreArmL = [-1.9, 0, 0]
    }

    if (s.attack > 0) {
      const a = s.attack
      const strike = Math.sin(Math.min(1, a) * Math.PI)
      if (s.holding === 'none') {
        t.upperArmR = [(-Math.PI / 2) * (0.6 + 0.4 * strike), 0, 0.2]
        t.foreArmR = [-1.6 * (1 - strike), 0, 0]
        t.chest = [0, 0.4 * strike, 0]
      } else if (s.holding === 'melee') {
        t.upperArmR = [-2.4 + 2.0 * a, 0, 0.6 - 0.8 * a]
        t.foreArmR = [-0.6 * (1 - a), 0, 0]
        t.chest = [0, 0.5 - 1.0 * a, 0]
      } else if (s.holding === 'throw') {
        t.upperArmR = [-2.8 + 2.4 * a, 0, 0.3]
        t.foreArmR = [-1.2 * (1 - a), 0, 0]
      }
    }

    if (s.seated) {
      hips = this.hipsY * 0.55
      t.thighL = [-1.5, 0, 0.05]
      t.thighR = [-1.5, 0, -0.05]
      t.shinL = [1.45, 0, 0]
      t.shinR = [1.45, 0, 0]
      t.footL = [0, 0, 0]
      t.footR = [0, 0, 0]
      t.spine = [-0.1, 0, 0]
      if (!s.aiming) {
        t.upperArmL = [-1.0, 0, -0.15]
        t.upperArmR = [-1.0, 0, 0.15]
        t.foreArmL = [-0.5, 0, 0]
        t.foreArmR = [-0.5, 0, 0]
      }
    }

    if (s.dead > 0) {
      const k = clamp(s.dead / 0.6, 0, 1)
      rootX = (-Math.PI / 2) * k * this.deathSide
      rootY = 0.12 * k
      rootZ = 0.3 * k
      hips = this.hipsY
      t.thighL = [0.1, 0, 0.3]
      t.thighR = [-0.1, 0, -0.2]
      t.shinL = [0.3, 0, 0]
      t.shinR = [0.1, 0, 0]
      t.upperArmL = [-1.2 * this.deathSide, 0, -1.2]
      t.upperArmR = [0.3, 0, 1.4]
      t.foreArmL = [-0.4, 0, 0]
      t.foreArmR = [-0.2, 0, 0]
      t.spine = [0, 0, 0]
      t.chest = [0, 0, 0]
      t.head = [0.2, 0.4, 0]
    }

    const lambda = s.dead > 0 ? 8 : s.attack > 0 ? 30 : 14
    for (const [name, target] of Object.entries(t) as [BoneName, Rot][]) {
      const cur = this.current.get(name) ?? [0, 0, 0]
      for (let i = 0; i < 3; i++) cur[i] = damp(cur[i], target[i], lambda, dt)
      this.current.set(name, cur)
      this.rig.bones[name].rotation.set(cur[0], cur[1], cur[2])
    }
    const hb = this.rig.bones.hips
    hb.position.y = damp(hb.position.y, hips, 14, dt)
    const root = this.rig.bones.root
    root.rotation.x = damp(root.rotation.x, rootX, 10, dt)
    root.position.y = damp(root.position.y, rootY, 10, dt)
    root.position.z = damp(root.position.z, rootZ, 10, dt)
  }
}
