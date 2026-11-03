import {
  BoxGeometry,
  BufferGeometry,
  Color,
  CylinderGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  LatheGeometry,
  Mesh,
  type MeshStandardMaterial,
  Object3D,
  Shape,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { vehicleLightsMaterial } from '../../render/materials'
import {
  Surface,
  disposePaint,
  paintMaterial,
  vehicleGlassMaterial,
  wheelMaterial,
} from '../../render/vehicleMaterials'
import type { VehicleSpec } from './specs'

export interface VehicleVisual {
  /** Follows the physics body (origin at ground level, facing +Z). */
  root: Group
  /** Child of root, used for visual lean (bikes). */
  tilt: Group
  wheels: Object3D[]
  rotors: { obj: Object3D; axis: 'y' | 'x' | 'z' }[]
  paint: MeshStandardMaterial
  paintMesh: Mesh
  lights: ReturnType<typeof vehicleLightsMaterial>
  /** Local seat position for the driver (character feet). */
  seat: Vector3
  /** Local position to exit to (left side). */
  exit: Vector3
}

type Col = [number, number, number]
const WHITE: Col = [1, 1, 1]
const BLACK: Col = [0.025, 0.025, 0.028]
const TRIM: Col = [0.05, 0.05, 0.055]
const CHROME: Col = [0.92, 0.92, 0.95]
const SEAT: Col = [0.12, 0.11, 0.1]

/** Non-indexed geometry with a flat vertex color, a surface kind and an optional light type. */
function prep(g: BufferGeometry, color: Col, kind: Surface, light?: number): BufferGeometry {
  const geo = g.index ? g.toNonIndexed() : g
  geo.deleteAttribute('uv')
  const n = geo.getAttribute('position').count
  const c = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) c.set(color, i * 3)
  geo.setAttribute('color', new Float32BufferAttribute(c, 3))
  geo.setAttribute('aKind', new Float32BufferAttribute(new Float32Array(n).fill(kind), 1))
  if (light !== undefined) geo.setAttribute('aLight', new Float32BufferAttribute(new Float32Array(n).fill(light), 1))
  return geo
}

const box = (w: number, h: number, l: number, x: number, y: number, z: number) =>
  new BoxGeometry(w, h, l).translate(x, y, z)
/** Rounded box (capsule-like edges) for softer details. */
const rbox = (w: number, h: number, l: number, x: number, y: number, z: number, r = 0.03) => {
  const s = new Shape()
  const hw = w / 2 - r
  const hh = h / 2 - r
  s.moveTo(-hw, -h / 2)
  s.lineTo(hw, -h / 2)
  s.quadraticCurveTo(w / 2, -h / 2, w / 2, -hh)
  s.lineTo(w / 2, hh)
  s.quadraticCurveTo(w / 2, h / 2, hw, h / 2)
  s.lineTo(-hw, h / 2)
  s.quadraticCurveTo(-w / 2, h / 2, -w / 2, hh)
  s.lineTo(-w / 2, -hh)
  s.quadraticCurveTo(-w / 2, -h / 2, -hw, -h / 2)
  const g = new ExtrudeGeometry(s, {
    depth: Math.max(0.001, l - 2 * r),
    bevelEnabled: true,
    bevelSize: r,
    bevelThickness: r,
    bevelSegments: 2,
    curveSegments: 3,
  })
  g.translate(0, 0, -(l - 2 * r) / 2)
  return g.translate(x, y, z)
}

/** Smooth closed curve through control points (centripetal Catmull-Rom sampled). */
function smoothPoints(ctrl: [number, number][], samples = 6): [number, number][] {
  const out: [number, number][] = []
  const n = ctrl.length
  for (let i = 0; i < n; i++) {
    const p0 = ctrl[(i - 1 + n) % n]
    const p1 = ctrl[i]
    const p2 = ctrl[(i + 1) % n]
    const p3 = ctrl[(i + 2) % n]
    for (let k = 0; k < samples; k++) {
      const t = k / samples
      const t2 = t * t
      const t3 = t2 * t
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3)
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])])
    }
  }
  return out
}

/** Side profile (z, y) extruded across the width, centered on X, then shaped (plan taper + tumblehome). */
function profile(
  points: [number, number][],
  width: number,
  opts: { bevel?: number; taper?: number; tumble?: { y0: number; y1: number; k: number }; halfLength: number },
): BufferGeometry {
  const s = new Shape()
  points.forEach(([z, y], i) => (i ? s.lineTo(z, y) : s.moveTo(z, y)))
  s.closePath()
  const bevel = opts.bevel ?? 0.07
  const depth = Math.max(0.01, width - bevel * 2)
  const g = new ExtrudeGeometry(s, {
    depth,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: 6,
    steps: 1,
  })
  g.translate(0, 0, -depth / 2)
  g.rotateY(-Math.PI / 2)
  // Shape in plan view and section: rounded nose/tail, inward-leaning upper sides.
  const pos = g.getAttribute('position')
  const taper = opts.taper ?? 0.1
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    const t = Math.min(1, Math.abs(z) / opts.halfLength)
    let k = 1 - taper * Math.pow(Math.max(0, (t - 0.55) / 0.45), 2)
    if (opts.tumble) {
      const u = Math.min(1, Math.max(0, (y - opts.tumble.y0) / (opts.tumble.y1 - opts.tumble.y0)))
      k *= 1 - opts.tumble.k * u * u
    }
    pos.setX(i, x * k)
  }
  g.computeVertexNormals()
  return g
}

const wheelCache = new Map<string, BufferGeometry>()
function wheelGeometry(r: number, w: number, side: 1 | -1): BufferGeometry {
  const key = `${r}:${w}:${side}`
  let g = wheelCache.get(key)
  if (g) return g
  // Tyre: lathe with rounded shoulders (axis X).
  const pts: Vector2[] = []
  const rimR = r * 0.66
  const steps = 10
  for (let i = 0; i <= steps; i++) {
    const a = -Math.PI / 2 + (i / steps) * Math.PI
    pts.push(new Vector2(r - w * 0.22 * (1 - Math.cos(a)), (w / 2) * Math.sin(a)))
  }
  pts.unshift(new Vector2(rimR, -w / 2 + 0.01))
  pts.push(new Vector2(rimR, w / 2 - 0.01))
  const tyre = prep(new LatheGeometry(pts, 28).rotateZ(Math.PI / 2), [0.035, 0.035, 0.037], Surface.Rubber)
  const face = side * (w / 2 - 0.02)
  const parts = [tyre]
  // Rim barrel + face
  parts.push(
    prep(new CylinderGeometry(rimR, rimR, w * 0.9, 24, 1, true).rotateZ(Math.PI / 2), [0.5, 0.5, 0.52], Surface.Metal),
  )
  parts.push(
    prep(
      new CylinderGeometry(rimR * 0.98, rimR * 0.98, 0.02, 24).rotateZ(Math.PI / 2).translate(face - side * 0.04, 0, 0),
      [0.25, 0.25, 0.27],
      Surface.Metal,
    ),
  )
  // Brake disc + caliper
  parts.push(
    prep(
      new CylinderGeometry(rimR * 0.78, rimR * 0.78, 0.025, 20).rotateZ(Math.PI / 2).translate(-side * 0.02, 0, 0),
      [0.35, 0.34, 0.33],
      Surface.Metal,
    ),
  )
  parts.push(
    prep(rbox(0.06, rimR * 0.45, rimR * 0.3, -side * 0.0, rimR * 0.55, 0, 0.015), [0.7, 0.08, 0.06], Surface.Trim),
  )
  // Five spokes + hub + lip
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2
    const spoke = new BoxGeometry(0.035, rimR * 0.95, rimR * 0.2)
      .translate(0, rimR * 0.5, 0)
      .rotateX(a)
      .translate(face, 0, 0)
    parts.push(prep(spoke, CHROME, Surface.Chrome))
  }
  parts.push(
    prep(
      new CylinderGeometry(rimR * 0.2, rimR * 0.22, 0.05, 12).rotateZ(Math.PI / 2).translate(face, 0, 0),
      CHROME,
      Surface.Chrome,
    ),
  )
  parts.push(
    prep(
      new TorusGeometry(rimR * 0.97, 0.012, 6, 28).rotateY(Math.PI / 2).translate(face, 0, 0),
      CHROME,
      Surface.Chrome,
    ),
  )
  g = mergeGeometries(parts)!
  parts.forEach((p) => p.dispose())
  wheelCache.set(key, g)
  return g
}

export function buildVehicle(spec: VehicleSpec, paintColor: Color): VehicleVisual {
  const root = new Group()
  const tilt = new Group()
  root.add(tilt)
  const paint = paintMaterial(paintColor, spec.armored ? 0.2 : spec.taxi || spec.police ? 0.25 : 0.5)
  const lights = vehicleLightsMaterial()
  const body: BufferGeometry[] = []
  const glass: BufferGeometry[] = []
  const lamp: BufferGeometry[] = []
  const rotors: VehicleVisual['rotors'] = []
  const L = spec.length
  const W = spec.width
  const zr = -L / 2
  const zf = L / 2
  const R = spec.wheelRadius
  const clear = R * 0.5
  let seat = new Vector3(-0.38, 0.35, 0.1)
  let exit = new Vector3(W / 2 + 0.8, 0, 0)

  const add = (g: BufferGeometry, color: Col, kind: Surface) => body.push(prep(g, color, kind))
  const light = (g: BufferGeometry, type: number, color: Col) => lamp.push(prep(g, color, Surface.Trim, type))

  if (spec.kind === 'car') {
    const belt = spec.belt
    const c = spec.cabin
    const top = belt + c.height
    if (spec.style === 'truck') {
      const cabZ = zr + c.start
      add(
        profile(
          smoothPoints(
            [
              [cabZ, clear],
              [zf - 0.1, clear + 0.05],
              [zf, clear + 0.4],
              [zf, top - 0.3],
              [zf - 0.35, top],
              [cabZ, top],
            ],
            3,
          ),
          W,
          { halfLength: L / 2, taper: 0.02, tumble: { y0: belt, y1: top, k: 0.04 } },
        ),
        WHITE,
        Surface.Paint,
      )
      glass.push(prep(box(W * 0.9, c.height * 0.55, 0.05, 0, belt + c.height * 0.5, zf - 0.08), WHITE, Surface.Trim))
      glass.push(prep(box(W + 0.01, c.height * 0.5, 1.0, 0, belt + c.height * 0.55, zf - 0.75), WHITE, Surface.Trim))
      const cargoL = c.start - 0.2
      add(
        rbox(W, top + 0.5 - clear - 0.3, cargoL, 0, (top + 0.5 + clear + 0.3) / 2, zr + cargoL / 2, 0.05),
        [0.92, 0.92, 0.9],
        Surface.Trim,
      )
      for (let z = zr + 0.6; z < zr + cargoL; z += 0.6)
        add(
          box(W + 0.02, top + 0.4 - clear - 0.3, 0.04, 0, (top + 0.5 + clear + 0.3) / 2, z),
          [0.8, 0.8, 0.78],
          Surface.Trim,
        )
      add(box(W * 0.9, 0.3, L - 0.4, 0, clear + 0.15, 0), TRIM, Surface.Trim)
      add(rbox(W * 0.7, 0.35, 0.1, 0, belt - 0.2, zf + 0.02), CHROME, Surface.Chrome)
      for (const sx of [-1, 1]) {
        light(rbox(0.3, 0.2, 0.06, sx * (W / 2 - 0.3), belt - 0.25, zf + 0.03), 0, [1, 0.96, 0.88])
        light(box(0.25, 0.15, 0.05, sx * (W / 2 - 0.25), clear + 0.5, zr - 0.01), 1, [1, 0.05, 0.03])
        add(
          new CylinderGeometry(0.07, 0.07, 1.6, 10).translate(sx * (W / 2 - 0.1), top + 0.3, cabZ + 0.15),
          CHROME,
          Surface.Chrome,
        )
      }
      seat = new Vector3(W * 0.24, belt - 0.72, zf - 1.2)
    } else {
      const sport = spec.style === 'sport'
      const boxy = spec.style === 'van' || spec.style === 'bus'
      const hood = belt - (sport ? 0.16 : boxy ? 0 : 0.08)
      const lower: [number, number][] = [
        [zr + 0.18, clear],
        [zf - 0.3, clear],
        [zf - 0.02, clear + 0.12],
        [zf + 0.02, clear + 0.32],
        [zf - 0.02, hood - 0.12],
        [zf - 0.35, hood],
        [zf - 1.0, hood + 0.03],
        [zr + c.start + 0.2, belt],
        [zr + 0.45, belt + (sport ? 0.04 : 0.02)],
        [zr + 0.05, belt - 0.1],
        [zr - 0.02, clear + 0.35],
        [zr + 0.04, clear + 0.12],
      ]
      add(
        profile(smoothPoints(lower, 5), W, {
          halfLength: L / 2,
          taper: boxy ? 0.04 : 0.12,
          tumble: { y0: belt - 0.35, y1: belt + 0.05, k: 0.05 },
          bevel: 0.08,
        }),
        WHITE,
        Surface.Paint,
      )
      const gs = zr + c.start
      const ge = zr + c.end
      const rs = zr + c.roofStart
      const re = zr + c.roofEnd
      const greenhouse = (w: number) =>
        profile(
          smoothPoints(
            [
              [gs, belt - 0.03],
              [ge, belt - 0.03],
              [ge - (re - ge) * -0.05 - 0.05, belt + 0.05],
              [re + 0.05, top - 0.05],
              [(rs + re) / 2, top + 0.02],
              [rs - 0.05, top - 0.05],
              [gs + 0.05, belt + 0.05],
            ],
            4,
          ),
          w,
          { halfLength: L / 2, taper: 0.06, tumble: { y0: belt, y1: top, k: boxy ? 0.05 : 0.14 }, bevel: 0.05 },
        )
      if (spec.style === 'van') {
        const cargoEnd = ge - 1.3
        add(
          profile(
            [
              [gs, belt - 0.02],
              [cargoEnd, belt - 0.02],
              [cargoEnd, top],
              [rs, top],
            ],
            W * 0.98,
            { halfLength: L / 2, taper: 0.03, bevel: 0.06 },
          ),
          WHITE,
          Surface.Paint,
        )
        glass.push(
          prep(
            profile(
              [
                [cargoEnd - 0.05, belt - 0.02],
                [ge, belt - 0.02],
                [re, top - 0.05],
                [cargoEnd - 0.05, top - 0.05],
              ],
              W * 0.92,
              { halfLength: L / 2, taper: 0.04, bevel: 0.04 },
            ),
            WHITE,
            Surface.Trim,
          ),
        )
        add(box(W * 0.95, 0.06, re - rs, 0, top, (rs + re) / 2), WHITE, Surface.Paint)
      } else {
        glass.push(prep(greenhouse(W * 0.88), WHITE, Surface.Trim))
        // Roof skin over the glass, pillars
        const roofT = spec.style === 'bus' ? 0.2 : 0.05
        add(
          rbox(W * 0.8, roofT, Math.max(0.3, re - rs - 0.1), 0, top + roofT / 2 - 0.01, (rs + re) / 2, 0.025),
          WHITE,
          Surface.Paint,
        )
        if (spec.style === 'bus') {
          for (let z = gs + 1.2; z < ge - 0.5; z += 1.6)
            add(box(W * 0.89, c.height, 0.12, 0, belt + c.height / 2, z), WHITE, Surface.Paint)
          add(box(W * 0.89, 0.25, ge - gs, 0, belt + 0.05, (gs + ge) / 2), WHITE, Surface.Paint)
        } else {
          for (const sx of [-1, 1]) {
            // B-pillar (black) and window frame line
            add(
              box(0.04, c.height * 0.92, 0.09, sx * W * 0.415, belt + c.height * 0.47, (rs + re) / 2 - 0.1),
              TRIM,
              Surface.Trim,
            )
          }
        }
      }
      // Wheel arches (dark liners) and side skirts
      for (const az of [spec.frontAxle, spec.rearAxle]) {
        for (const sx of [-1, 1]) {
          const arch = new TorusGeometry(R + 0.06, 0.05, 6, 16, Math.PI)
            .rotateY(Math.PI / 2)
            .translate(sx * (W / 2 - 0.02), R, az)
          add(arch, BLACK, Surface.Trim)
          add(
            new CylinderGeometry(R + 0.04, R + 0.04, 0.3, 16, 1, true, 0, Math.PI)
              .rotateZ(Math.PI / 2)
              .translate(sx * (W / 2 - 0.2), R, az),
            BLACK,
            Surface.Trim,
          )
        }
      }
      add(
        rbox(
          W + 0.01,
          0.1,
          spec.frontAxle - spec.rearAxle - 2 * R - 0.2,
          0,
          clear + 0.06,
          (spec.frontAxle + spec.rearAxle) / 2,
          0.03,
        ),
        TRIM,
        Surface.Trim,
      )
      // Bumpers, grille, plates, exhaust
      add(
        rbox(W + 0.04, 0.24, 0.2, 0, clear + 0.17, zf - 0.04, 0.06),
        sport ? WHITE : TRIM,
        sport ? Surface.Paint : Surface.Trim,
      )
      add(rbox(W + 0.04, 0.24, 0.2, 0, clear + 0.17, zr + 0.06, 0.06), TRIM, Surface.Trim)
      add(rbox(W * 0.42, 0.16, 0.06, 0, hood - 0.27, zf + 0.0, 0.02), BLACK, Surface.Trim)
      add(rbox(W * 0.44, 0.18, 0.04, 0, hood - 0.27, zf - 0.01, 0.02), CHROME, Surface.Chrome)
      add(box(0.5, 0.12, 0.02, 0, clear + 0.3, zf + 0.06), [0.9, 0.9, 0.86], Surface.Trim)
      add(box(0.5, 0.12, 0.02, 0, clear + 0.42, zr - 0.04), [0.9, 0.9, 0.86], Surface.Trim)
      add(
        new CylinderGeometry(0.045, 0.045, 0.25, 10).rotateX(Math.PI / 2).translate(-W * 0.3, clear + 0.08, zr + 0.02),
        CHROME,
        Surface.Chrome,
      )
      // Door seams, handles, mirrors
      for (const sx of [-1, 1]) {
        const x = sx * (W / 2 + 0.002)
        add(
          box(0.012, belt - clear - 0.2, 0.012, x, (belt + clear) / 2 + 0.05, (rs + re) / 2 - 0.1),
          BLACK,
          Surface.Trim,
        )
        add(box(0.012, belt - clear - 0.2, 0.012, x, (belt + clear) / 2 + 0.05, ge - 0.05), BLACK, Surface.Trim)
        add(rbox(0.03, 0.035, 0.16, sx * (W / 2 + 0.01), belt - 0.15, ge - 0.4, 0.012), CHROME, Surface.Chrome)
        add(
          rbox(0.03, 0.035, 0.16, sx * (W / 2 + 0.01), belt - 0.15, (rs + re) / 2 - 0.5, 0.012),
          CHROME,
          Surface.Chrome,
        )
        add(rbox(0.16, 0.11, 0.08, sx * (W / 2 + 0.07), belt + 0.1, ge - 0.25, 0.03), WHITE, Surface.Paint)
        glass.push(prep(box(0.01, 0.08, 0.06, sx * (W / 2 + 0.12), belt + 0.1, ge - 0.21), WHITE, Surface.Trim))
      }
      // Lights with chrome bezels
      for (const sx of [-1, 1]) {
        add(rbox(0.42, 0.16, 0.06, sx * (W / 2 - 0.3), hood - 0.17, zf - 0.05, 0.03), CHROME, Surface.Chrome)
        light(rbox(0.36, 0.11, 0.05, sx * (W / 2 - 0.3), hood - 0.17, zf - 0.01, 0.025), 0, [1, 0.96, 0.88])
        light(rbox(0.4, 0.13, 0.05, sx * (W / 2 - 0.28), belt - 0.22, zr + 0.0, 0.025), 1, [1, 0.04, 0.03])
        light(box(0.08, 0.06, 0.03, sx * (W / 2 - 0.12), belt - 0.22, zr - 0.01), 1, [1, 0.45, 0.05])
      }
      // Interior: seats, dashboard, steering wheel (visible through the glass)
      const sz = (rs + re) / 2 - 0.35
      for (const sx of [-1, 1]) {
        add(rbox(0.5, 0.12, 0.5, sx * W * 0.22, belt - 0.5, sz, 0.05), SEAT, Surface.Fabric)
        add(rbox(0.5, 0.65, 0.12, sx * W * 0.22, belt - 0.15, sz - 0.3, 0.05), SEAT, Surface.Fabric)
      }
      if (!boxy) add(rbox(W * 0.8, 0.5, 0.45, 0, belt - 0.4, sz - 1.05, 0.06), SEAT, Surface.Fabric)
      add(rbox(W * 0.86, 0.18, 0.5, 0, belt - 0.05, ge - 0.45, 0.06), TRIM, Surface.Trim)
      add(
        new TorusGeometry(0.18, 0.025, 6, 16).rotateX(-0.4).translate(W * 0.22, belt + 0.05, ge - 0.75),
        TRIM,
        Surface.Trim,
      )
      if (spec.police && !spec.armored) {
        add(rbox(1.2, 0.08, 0.3, 0, top + 0.05, (rs + re) / 2, 0.03), TRIM, Surface.Trim)
        light(rbox(0.5, 0.11, 0.24, 0.3, top + 0.13, (rs + re) / 2, 0.04), 2, [1, 0.05, 0.05])
        light(rbox(0.5, 0.11, 0.24, -0.3, top + 0.13, (rs + re) / 2, 0.04), 3, [0.1, 0.25, 1])
        add(box(W + 0.03, 0.22, L * 0.5, 0, belt - 0.32, 0.1), [0.04, 0.06, 0.14], Surface.Trim)
        add(rbox(W * 0.9, 0.25, 0.12, 0, clear + 0.3, zf + 0.12, 0.03), BLACK, Surface.Trim)
      }
      if (spec.armored) {
        light(rbox(0.3, 0.1, 0.1, 0.5, belt + 0.3, zf - 0.9), 2, [1, 0.05, 0.05])
        light(rbox(0.3, 0.1, 0.1, -0.5, belt + 0.3, zf - 0.9), 3, [0.1, 0.25, 1])
      }
      if (spec.taxi) {
        add(rbox(0.62, 0.2, 0.26, 0, top + 0.1, (rs + re) / 2, 0.04), [1, 0.85, 0.2], Surface.Trim)
        add(box(W + 0.02, 0.08, L * 0.6, 0, belt - 0.3, 0), BLACK, Surface.Trim)
      }
      if (spec.style === 'suv') {
        for (const sx of [-1, 1])
          add(rbox(0.04, 0.05, re - rs, sx * W * 0.36, top + 0.04, (rs + re) / 2, 0.02), CHROME, Surface.Chrome)
      }
      if (sport) add(rbox(W * 0.9, 0.04, 0.3, 0, belt + 0.18, zr + 0.25, 0.02), TRIM, Surface.Trim)
      // Siège bas : avec le dossier incliné, la tête du conducteur reste sous le toit.
      seat = new Vector3(W * 0.22, belt - 0.72 - (sport ? 0.08 : 0), sz)
      if (spec.style === 'bus') seat = new Vector3(W * 0.25, belt - 0.55, zf - 1.4)
      if (spec.style === 'van') seat = new Vector3(W * 0.24, belt - 0.55, ge - 1.0)
    }
    exit = new Vector3(W / 2 + 0.9, 0, seat.z)
  } else if (spec.kind === 'bike') {
    const r = R
    add(rbox(0.09, 0.09, 1.0, 0, r + 0.28, 0, 0.03), TRIM, Surface.Trim)
    add(new SphereGeometry(0.22, 16, 12).scale(0.85, 0.7, 1.45).translate(0, r + 0.56, 0.12), WHITE, Surface.Paint)
    add(rbox(0.26, 0.1, 0.62, 0, r + 0.5, -0.36, 0.04), [0.08, 0.07, 0.07], Surface.Fabric)
    add(rbox(0.3, 0.32, 0.46, 0, r + 0.2, -0.05, 0.05), [0.3, 0.3, 0.32], Surface.Metal)
    for (const sx of [-1, 1])
      add(
        new CylinderGeometry(0.03, 0.03, 0.72, 8).rotateX(-0.35).translate(sx * 0.1, r + 0.32, spec.frontAxle - 0.12),
        CHROME,
        Surface.Chrome,
      )
    add(
      new CylinderGeometry(0.015, 0.015, 0.7, 8).rotateZ(Math.PI / 2).translate(0, r + 0.68, spec.frontAxle - 0.24),
      CHROME,
      Surface.Chrome,
    )
    add(
      new CylinderGeometry(0.05, 0.04, 0.6, 10)
        .rotateX(Math.PI / 2 - 0.15)
        .translate(0.16, r + 0.08, spec.rearAxle + 0.35),
      CHROME,
      Surface.Chrome,
    )
    add(rbox(0.28, 0.08, 0.42, 0, r + 0.38, spec.rearAxle + 0.02, 0.03), WHITE, Surface.Paint)
    add(rbox(0.22, 0.06, 0.38, 0, r + 0.36, spec.frontAxle - 0.02, 0.03), WHITE, Surface.Paint)
    add(
      new SphereGeometry(0.1, 12, 8).scale(1, 1, 0.6).translate(0, r + 0.56, spec.frontAxle - 0.08),
      CHROME,
      Surface.Chrome,
    )
    light(
      new SphereGeometry(0.075, 12, 8).scale(1, 1, 0.4).translate(0, r + 0.56, spec.frontAxle - 0.02),
      0,
      [1, 0.96, 0.88],
    )
    light(rbox(0.14, 0.06, 0.04, 0, r + 0.42, spec.rearAxle - 0.2), 1, [1, 0.04, 0.03])
    seat = new Vector3(0, r + 0.08, -0.4)
    exit = new Vector3(0.9, 0, 0)
  } else if (spec.kind === 'heli') {
    add(new SphereGeometry(1.2, 28, 20).scale(1, 0.9, 1.7).translate(0, 1.6, 0.6), WHITE, Surface.Paint)
    glass.push(
      prep(
        new SphereGeometry(1.02, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.6)
          .rotateX(Math.PI / 2.2)
          .scale(0.95, 0.8, 1)
          .translate(0, 1.7, 1.55),
        WHITE,
        Surface.Trim,
      ),
    )
    add(new CylinderGeometry(0.16, 0.38, 4.6, 16).rotateX(Math.PI / 2).translate(0, 1.9, -3.2), WHITE, Surface.Paint)
    add(rbox(0.08, 1.1, 0.7, 0, 2.3, -5.3, 0.03), WHITE, Surface.Paint)
    add(rbox(1.6, 0.06, 0.4, 0, 1.95, -4.6, 0.02), WHITE, Surface.Paint)
    for (const sx of [-1, 1]) {
      add(
        new CylinderGeometry(0.055, 0.055, 3.2, 10).rotateX(Math.PI / 2).translate(sx * 0.9, 0.08, 0.5),
        CHROME,
        Surface.Chrome,
      )
      add(new CylinderGeometry(0.04, 0.04, 0.7, 8).translate(sx * 0.85, 0.42, 1.2), TRIM, Surface.Trim)
      add(new CylinderGeometry(0.04, 0.04, 0.7, 8).translate(sx * 0.85, 0.42, -0.2), TRIM, Surface.Trim)
    }
    add(new CylinderGeometry(0.15, 0.22, 0.5, 12).translate(0, 2.85, 0.4), [0.3, 0.3, 0.32], Surface.Metal)
    add(rbox(0.6, 0.3, 1.2, 0, 2.6, 0.2, 0.1), WHITE, Surface.Paint)
    for (const sx of [-1, 1]) add(rbox(0.4, 0.5, 0.45, sx * 0.4, 1.3, 1.1, 0.06), SEAT, Surface.Fabric)
    if (spec.police) {
      light(rbox(0.25, 0.1, 0.25, 0.4, 0.75, 1.4), 2, [1, 0.05, 0.05])
      light(rbox(0.25, 0.1, 0.25, -0.4, 0.75, 1.4), 3, [0.1, 0.25, 1])
    }
    light(new SphereGeometry(0.1, 10, 8).translate(0, 0.95, 2.5), 0, [1, 0.96, 0.88])
    const blade = (len: number, w: number) =>
      mergeGeometries([
        prep(rbox(len, 0.04, w, 0, 0, 0, 0.015), [0.06, 0.06, 0.06], Surface.Trim),
        prep(rbox(w, 0.04, len, 0, 0, 0, 0.015), [0.06, 0.06, 0.06], Surface.Trim),
      ])!
    const main = new Mesh(blade(9, 0.28), wheelMaterial)
    main.position.set(0, 3.12, 0.4)
    main.castShadow = true
    tilt.add(main)
    rotors.push({ obj: main, axis: 'y' })
    const tail = new Mesh(prep(rbox(0.03, 1.3, 0.14, 0, 0, 0, 0.01), [0.06, 0.06, 0.06], Surface.Trim), wheelMaterial)
    tail.position.set(0.15, 2.4, -5.4)
    tilt.add(tail)
    rotors.push({ obj: tail, axis: 'x' })
    seat = new Vector3(0.45, 1.05, 1.4)
    exit = new Vector3(2.2, 0, 0.8)
  } else if (spec.kind === 'plane') {
    add(new CylinderGeometry(0.58, 0.22, 7, 20).rotateX(Math.PI / 2).translate(0, 1.6, 0), WHITE, Surface.Paint)
    add(new SphereGeometry(0.58, 20, 12).scale(1, 1, 1.2).translate(0, 1.6, 3.5), WHITE, Surface.Paint)
    glass.push(prep(new SphereGeometry(0.5, 16, 10).scale(0.9, 0.7, 1.5).translate(0, 2.05, 1.6), WHITE, Surface.Trim))
    add(rbox(spec.width, 0.12, 1.5, 0, 2.25, 1.0, 0.05), WHITE, Surface.Paint)
    add(rbox(3.2, 0.08, 0.8, 0, 1.75, -3.2, 0.03), WHITE, Surface.Paint)
    add(rbox(0.08, 1.3, 0.9, 0, 2.3, -3.3, 0.03), [0.75, 0.1, 0.1], Surface.Trim)
    add(box(spec.width * 0.98, 0.13, 0.15, 0, 2.25, 1.0), [0.75, 0.1, 0.1], Surface.Trim)
    for (const sx of [-1, 1]) {
      add(new CylinderGeometry(0.03, 0.03, 1.0, 6).rotateZ(sx * 0.35).translate(sx * 0.6, 1.8, 1.2), TRIM, Surface.Trim)
      add(new CylinderGeometry(0.05, 0.05, 1.0, 8).translate(sx * 1.2, 0.8, -0.4), CHROME, Surface.Chrome)
    }
    add(new CylinderGeometry(0.05, 0.05, 1.0, 8).translate(0, 0.8, 2.6), CHROME, Surface.Chrome)
    add(new SphereGeometry(0.16, 12, 8).scale(1, 1, 1.5).translate(0, 1.6, 4.15), CHROME, Surface.Chrome)
    light(new SphereGeometry(0.06, 8, 6).translate(spec.width / 2 - 0.05, 2.25, 1.6), 1, [1, 0.06, 0.04])
    light(new SphereGeometry(0.06, 8, 6).translate(-spec.width / 2 + 0.05, 2.25, 1.6), 0, [0.4, 1, 0.4])
    const prop = new Mesh(prep(rbox(0.12, 2.0, 0.05, 0, 0, 0, 0.02), [0.05, 0.05, 0.05], Surface.Trim), wheelMaterial)
    prop.position.set(0, 1.6, 4.3)
    tilt.add(prop)
    rotors.push({ obj: prop, axis: 'z' })
    seat = new Vector3(0, 1.25, 1.4)
    exit = new Vector3(1.5, 0, 0.5)
  }

  const paintMesh = new Mesh(mergeGeometries(body)!, paint)
  paintMesh.castShadow = true
  paintMesh.receiveShadow = true
  tilt.add(paintMesh)
  if (glass.length) {
    const g = new Mesh(mergeGeometries(glass)!, vehicleGlassMaterial)
    g.renderOrder = 2
    tilt.add(g)
  }
  if (lamp.length) tilt.add(new Mesh(mergeGeometries(lamp)!, lights.material))
  ;[...body, ...glass, ...lamp].forEach((g) => g.dispose())

  const wheels: Object3D[] = []
  if (spec.kind === 'car' || spec.kind === 'bike' || spec.kind === 'plane') {
    const positions =
      spec.kind === 'bike'
        ? [
            [0, spec.frontAxle],
            [0, spec.rearAxle],
          ]
        : spec.kind === 'plane'
          ? [
              [0, spec.frontAxle],
              [spec.track / 2, spec.rearAxle],
              [-spec.track / 2, spec.rearAxle],
            ]
          : [
              [W / 2 - spec.wheelWidth / 2 - 0.03, spec.frontAxle],
              [-(W / 2 - spec.wheelWidth / 2 - 0.03), spec.frontAxle],
              [W / 2 - spec.wheelWidth / 2 - 0.03, spec.rearAxle],
              [-(W / 2 - spec.wheelWidth / 2 - 0.03), spec.rearAxle],
            ]
    for (const [x, z] of positions) {
      const pivot = new Object3D()
      pivot.position.set(x, R, z)
      const m = new Mesh(wheelGeometry(R, spec.wheelWidth, x >= 0 ? 1 : -1), wheelMaterial)
      m.castShadow = true
      pivot.add(m)
      ;(spec.kind === 'bike' ? tilt : root).add(pivot)
      wheels.push(pivot)
    }
  }

  return { root, tilt, wheels, rotors, paint, paintMesh, lights, seat, exit }
}

export function disposeVehicleVisual(v: VehicleVisual) {
  v.root.removeFromParent()
  v.root.traverse((o) => {
    if (o instanceof Mesh && ![...wheelCache.values()].includes(o.geometry)) o.geometry.dispose()
  })
  disposePaint(v.paint)
  v.lights.material.dispose()
}
