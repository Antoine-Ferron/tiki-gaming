import {
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  IcosahedronGeometry,
  SphereGeometry,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { PropKind } from './city'

type Col = [number, number, number]

function c(g: BufferGeometry, col: Col): BufferGeometry {
  const geo = g.index ? g.toNonIndexed() : g
  geo.deleteAttribute('uv')
  const n = geo.getAttribute('position').count
  const arr = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) arr.set(col, i * 3)
  geo.setAttribute('color', new Float32BufferAttribute(arr, 3))
  return geo
}
const merge = (parts: BufferGeometry[]) => {
  const g = mergeGeometries(parts)!
  parts.forEach((p) => p.dispose())
  g.computeBoundingSphere()
  return g
}
const POLE: Col = [0.32, 0.33, 0.35]

/** Static part of each prop (vertex colored). Local +Z faces the road. */
export const PROP_GEOMETRY: Record<PropKind, () => BufferGeometry> = {
  lamp: () =>
    merge([
      c(new CylinderGeometry(0.08, 0.12, 7, 8).translate(0, 3.5, 0), POLE),
      c(new BoxGeometry(0.08, 0.08, 2.0).translate(0, 7, 1), POLE),
      c(new CylinderGeometry(0.2, 0.2, 0.3, 8).translate(0, 0.15, 0), POLE),
    ]),
  trafficLight: () =>
    merge([
      c(new CylinderGeometry(0.09, 0.11, 5.2, 8).translate(0, 2.6, 0), POLE),
      c(new BoxGeometry(3.4, 0.1, 0.1).translate(-1.7, 5.1, 0), POLE),
      c(new BoxGeometry(0.35, 0.95, 0.3).translate(-3.2, 4.6, 0), [0.05, 0.05, 0.05]),
    ]),
  tree: () =>
    merge([
      c(new CylinderGeometry(0.15, 0.22, 2.6, 6).translate(0, 1.3, 0), [0.32, 0.22, 0.14]),
      c(new IcosahedronGeometry(1.7, 0).translate(0, 3.6, 0), [0.22, 0.42, 0.18]),
      c(new IcosahedronGeometry(1.2, 0).translate(0.6, 4.6, 0.3), [0.26, 0.48, 0.2]),
      c(new IcosahedronGeometry(1.1, 0).translate(-0.7, 4.2, -0.4), [0.2, 0.38, 0.16]),
    ]),
  palm: () => {
    const parts = [c(new CylinderGeometry(0.16, 0.24, 7, 6).translate(0, 3.5, 0), [0.45, 0.35, 0.22])]
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2
      parts.push(
        c(
          new BoxGeometry(0.5, 0.06, 2.6).translate(0, 0, 1.3).rotateX(0.5).rotateY(a).translate(0, 7, 0),
          [0.25, 0.5, 0.18],
        ),
      )
    }
    return merge(parts)
  },
  hydrant: () =>
    merge([
      c(new CylinderGeometry(0.16, 0.18, 0.7, 8).translate(0, 0.35, 0), [0.75, 0.1, 0.08]),
      c(new SphereGeometry(0.17, 8, 6).translate(0, 0.72, 0), [0.75, 0.1, 0.08]),
      c(new CylinderGeometry(0.06, 0.06, 0.5, 6).rotateZ(Math.PI / 2).translate(0, 0.5, 0), [0.6, 0.6, 0.6]),
    ]),
  bin: () =>
    merge([
      c(new CylinderGeometry(0.3, 0.26, 0.95, 10).translate(0, 0.475, 0), [0.15, 0.3, 0.2]),
      c(new CylinderGeometry(0.32, 0.32, 0.06, 10).translate(0, 0.98, 0), [0.1, 0.2, 0.14]),
    ]),
  bench: () =>
    merge([
      c(new BoxGeometry(1.8, 0.06, 0.45).translate(0, 0.45, 0), [0.45, 0.28, 0.14]),
      c(new BoxGeometry(1.8, 0.4, 0.05).translate(0, 0.7, -0.22), [0.45, 0.28, 0.14]),
      c(new BoxGeometry(0.06, 0.45, 0.45).translate(-0.8, 0.22, 0), POLE),
      c(new BoxGeometry(0.06, 0.45, 0.45).translate(0.8, 0.22, 0), POLE),
    ]),
}

/** Collider half-extents and center height per prop kind (null = no collider). */
export const PROP_COLLIDER: Record<
  PropKind,
  { hx: number; hy: number; hz: number; y: number; mass: number; breakForce: number } | null
> = {
  lamp: { hx: 0.12, hy: 3.5, hz: 0.12, y: 3.5, mass: 120, breakForce: 2.5e5 },
  trafficLight: { hx: 0.12, hy: 2.6, hz: 0.12, y: 2.6, mass: 150, breakForce: 4e5 },
  tree: { hx: 0.22, hy: 1.5, hz: 0.22, y: 1.5, mass: 0, breakForce: Infinity },
  palm: { hx: 0.24, hy: 3, hz: 0.24, y: 3, mass: 0, breakForce: Infinity },
  hydrant: { hx: 0.18, hy: 0.4, hz: 0.18, y: 0.4, mass: 60, breakForce: 1.2e5 },
  bin: { hx: 0.3, hy: 0.5, hz: 0.3, y: 0.5, mass: 25, breakForce: 4e4 },
  bench: { hx: 0.9, hy: 0.45, hz: 0.25, y: 0.45, mass: 40, breakForce: 6e4 },
}

export function lampHeadGeometry() {
  return new BoxGeometry(0.5, 0.15, 0.3).translate(0, 6.92, 1.9)
}
export function signalGeometry() {
  return new SphereGeometry(0.13, 8, 6).translate(-3.2, 4.6, 0.17)
}

export function craneGeometry(): BufferGeometry {
  const yel: Col = [0.85, 0.62, 0.1]
  const parts: BufferGeometry[] = []
  for (const dx of [-5, 5])
    for (const dz of [-5, 5]) parts.push(c(new BoxGeometry(0.8, 28, 0.8).translate(dx, 14, dz), yel))
  parts.push(c(new BoxGeometry(11, 1.2, 1.2).translate(0, 28, -5), yel))
  parts.push(c(new BoxGeometry(11, 1.2, 1.2).translate(0, 28, 5), yel))
  parts.push(c(new BoxGeometry(46, 1.6, 2.2).translate(-12, 30, 0), yel))
  parts.push(c(new BoxGeometry(4, 3, 3).translate(2, 32, 0), [0.8, 0.8, 0.8]))
  return merge(parts)
}

export function containerGeometry(): BufferGeometry {
  const g = c(new BoxGeometry(2.5, 2.6, 12), [1, 1, 1])
  // Corrugation hint: darker frame
  return merge([g, c(new BoxGeometry(2.56, 0.12, 12.04).translate(0, 1.25, 0), [0.6, 0.6, 0.6])])
}
