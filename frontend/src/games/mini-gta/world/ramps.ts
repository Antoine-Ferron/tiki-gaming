import type { GeoBuilder } from '../render/GeoBuilder'
import type { Ramp, RampKind } from './city'

type V3 = [number, number, number]

/** Couleur de chaque matière de tremplin. */
export const RAMP_COLORS: Record<RampKind, V3> = {
  dirt: [0.42, 0.33, 0.22],
  concrete: [0.56, 0.56, 0.54],
  planks: [0.55, 0.4, 0.24],
}

/** Épaisseur (m) de la dalle de collision posée sous la pente. */
const SLAB = 0.4

/** Point local du tremplin (x en travers, y en hauteur, z dans le sens de la montée) vers le monde. */
export function rampToWorld(r: Ramp, lx: number, ly: number, lz: number): V3 {
  const c = Math.cos(r.rot)
  const s = Math.sin(r.rot)
  return [r.x + lx * c + lz * s, r.y + ly, r.z - lx * s + lz * c]
}

/** Coin plein : pente, dos vertical et flancs (le dessous est contre le sol). */
export function addRampGeometry(bb: GeoBuilder, r: Ramp, seed: number) {
  const w = r.width / 2
  const l = r.length / 2
  const h = r.height
  const p = (x: number, y: number, z: number) => rampToWorld(r, x, y, z)
  const A = p(-w, 0, -l)
  const B = p(w, 0, -l)
  const C = p(w, h, l)
  const D = p(-w, h, l)
  const E = p(w, 0, l)
  const F = p(-w, 0, l)
  const color = RAMP_COLORS[r.kind]
  const shade = (k: number): V3 => [color[0] * k, color[1] * k, color[2] * k]
  // Coordonnées de texture en mètres dans le monde : motif continu d'un tremplin à l'autre.
  const attrs = (pts: V3[]) => (i: number) => ({ aUvM: [pts[i][0], pts[i][2]], aInfo: [-2, seed] })
  bb.quad(A, D, C, B, null, color, attrs([A, D, C, B]))
  bb.quad(F, E, C, D, null, shade(0.8), attrs([F, E, C, D]))
  bb.tri(B, C, E, shade(0.88), attrs([B, C, E]))
  bb.tri(A, F, D, shade(0.88), attrs([A, F, D]))
}

/** Rotation (quaternion) d'un cap autour de Y suivi d'un tangage autour de l'axe X local. */
function yawPitch(yaw: number, pitch: number) {
  const cy = Math.cos(yaw / 2)
  const sy = Math.sin(yaw / 2)
  const cp = Math.cos(pitch / 2)
  const sp = Math.sin(pitch / 2)
  // q = qYaw(Y) · qPitch(X)
  return { x: cy * sp, y: sy * cp, z: -sy * sp, w: cy * cp }
}

/**
 * Colliders d'un tremplin : une dalle inclinée dont le dessus suit la pente (roues et caisse y montent) et un
 * dos vertical sous l'arête haute.
 */
export function rampColliders(r: Ramp) {
  const a = Math.atan2(r.height, r.length)
  const slope = Math.hypot(r.length, r.height)
  // Centre de la dalle : milieu de la pente, enfoncé d'une demi-épaisseur le long de la normale (0, cos a, −sin a).
  const n = { y: Math.cos(a), z: -Math.sin(a) }
  const slab = {
    center: rampToWorld(r, 0, r.height / 2 - (n.y * SLAB) / 2, -(n.z * SLAB) / 2),
    half: { x: r.width / 2, y: SLAB / 2, z: slope / 2 },
    rotation: yawPitch(r.rot, -a),
  }
  const back = {
    center: rampToWorld(r, 0, r.height / 2, r.length / 2 - SLAB / 2),
    half: { x: r.width / 2, y: r.height / 2, z: SLAB / 2 },
    rotation: yawPitch(r.rot, 0),
  }
  return [slab, back]
}
