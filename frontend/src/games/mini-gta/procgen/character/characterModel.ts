/* v8 ignore file -- rendu visuel (WebGL, shaders, géométries, canvas) : vérifié à l'écran, sans règle de jeu. Voir docs/games/mini-gta/regles.md § 6. */
import {
  Bone,
  BufferGeometry,
  CapsuleGeometry,
  Color,
  CylinderGeometry,
  Float32BufferAttribute,
  Group,
  Matrix4,
  Skeleton,
  SkinnedMesh,
  SphereGeometry,
  Uint16BufferAttribute,
  Vector3,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { Rng } from '../../core/rng'
import { characterMaterial } from '../../render/characterMaterial'

export const BONES = [
  'root',
  'hips',
  'spine',
  'chest',
  'neck',
  'head',
  'upperArmL',
  'foreArmL',
  'handL',
  'upperArmR',
  'foreArmR',
  'handR',
  'thighL',
  'shinL',
  'footL',
  'thighR',
  'shinR',
  'footR',
] as const
export type BoneName = (typeof BONES)[number]

/** Surface types understood by the character shader (attribute aMat). */
export const enum Mat {
  Skin = 0,
  Cloth = 1,
  Leather = 2,
  Hair = 3,
  EyeWhite = 4,
  Iris = 5,
}

export type HairStyle = 'short' | 'long' | 'buzz' | 'bald' | 'curly'

export interface CharacterLook {
  height: number
  build: number
  skin: Color
  shirt: Color
  pants: Color
  shoes: Color
  hair: Color
  hairStyle: HairStyle
  eyes: Color
  hat?: Color
  /** Short sleeves show skin on forearms. */
  shortSleeves: boolean
  /** Jacket / vest over the shirt (police vest, player jacket). */
  vest?: Color
  feminine: boolean
}

const SKINS = ['#f3cfb3', '#e0ac8a', '#c68a64', '#9c6644', '#6e4630', '#4a2e20', '#ecbf9c']
const SHIRTS = [
  '#b03a2e',
  '#2e6fb5',
  '#2f8f57',
  '#d9902a',
  '#7d4a96',
  '#e8e6e1',
  '#34495e',
  '#1f7a6d',
  '#c25a1c',
  '#23303d',
  '#7f8c8d',
  '#c4497a',
  '#d8c9a7',
]
const PANTS = ['#26313d', '#2f3a4a', '#1c1f24', '#5a4232', '#3a5577', '#6d7378', '#b8a98a', '#40362b']
const HAIRS = ['#16120f', '#2e2016', '#5a3a22', '#a9844f', '#7d7a75', '#3d1c10', '#d2b47a']
const EYES = ['#4a3020', '#2f5d8a', '#3f6b3a', '#6b4b2a', '#1e1e1e']

export function randomLook(rng: Rng): CharacterLook {
  const feminine = rng.chance(0.45)
  return {
    height: rng.range(0.93, 1.07) * (feminine ? 0.95 : 1),
    build: rng.range(0.9, 1.18) * (feminine ? 0.92 : 1),
    skin: new Color(rng.pick(SKINS)),
    shirt: new Color(rng.pick(SHIRTS)),
    pants: new Color(rng.pick(PANTS)),
    shoes: new Color(rng.chance(0.6) ? '#151515' : rng.pick(['#ecf0f1', '#6d4c41', '#8a2c22', '#2c3e50'])),
    hair: new Color(rng.pick(HAIRS)),
    hairStyle: feminine
      ? rng.pick<HairStyle>(['long', 'long', 'curly', 'short'])
      : rng.pick<HairStyle>(['short', 'short', 'buzz', 'bald', 'curly']),
    eyes: new Color(rng.pick(EYES)),
    shortSleeves: rng.chance(0.45),
    feminine,
  }
}

export function policeLook(rng: Rng, swat = false): CharacterLook {
  const look = randomLook(rng)
  look.shirt = new Color(swat ? '#1f2328' : '#2b3c58')
  look.pants = new Color(swat ? '#1f2328' : '#1b2436')
  look.shoes = new Color('#0f0f0f')
  look.hat = new Color(swat ? '#15181c' : '#1b2436')
  look.vest = new Color(swat ? '#2b2f33' : '#1d2a3f')
  look.shortSleeves = !swat && rng.chance(0.5)
  if (look.hairStyle === 'long' || look.hairStyle === 'curly') look.hairStyle = 'short'
  return look
}

export function playerLook(): CharacterLook {
  return {
    height: 1.02,
    build: 1.06,
    skin: new Color('#c99472'),
    shirt: new Color('#e9e4d8'),
    pants: new Color('#2a3a52'),
    shoes: new Color('#3a2a1e'),
    hair: new Color('#16120f'),
    hairStyle: 'short',
    eyes: new Color('#4a3020'),
    shortSleeves: true,
    vest: new Color('#3d2b1f'),
    feminine: false,
  }
}

/** Rest-pose bone offsets (relative to parent). */
function restOffsets(look: CharacterLook): Record<BoneName, [number, number, number]> {
  const s = look.height
  const w = look.build
  const sh = look.feminine ? 0.9 : 1
  return {
    root: [0, 0, 0],
    hips: [0, 0.95 * s, 0],
    spine: [0, 0.1 * s, 0],
    chest: [0, 0.2 * s, 0],
    neck: [0, 0.27 * s, 0],
    head: [0, 0.08 * s, 0],
    upperArmL: [0.2 * w * sh, 0.22 * s, 0],
    foreArmL: [0, -0.28 * s, 0],
    handL: [0, -0.25 * s, 0],
    upperArmR: [-0.2 * w * sh, 0.22 * s, 0],
    foreArmR: [0, -0.28 * s, 0],
    handR: [0, -0.25 * s, 0],
    thighL: [0.1 * w, -0.04 * s, 0],
    shinL: [0, -0.44 * s, 0],
    footL: [0, -0.42 * s, 0],
    thighR: [-0.1 * w, -0.04 * s, 0],
    shinR: [0, -0.44 * s, 0],
    footR: [0, -0.42 * s, 0],
  }
}

const PARENT: Record<BoneName, BoneName | null> = {
  root: null,
  hips: 'root',
  spine: 'hips',
  chest: 'spine',
  neck: 'chest',
  head: 'neck',
  upperArmL: 'chest',
  foreArmL: 'upperArmL',
  handL: 'foreArmL',
  upperArmR: 'chest',
  foreArmR: 'upperArmR',
  handR: 'foreArmR',
  thighL: 'hips',
  shinL: 'thighL',
  footL: 'shinL',
  thighR: 'hips',
  shinR: 'thighR',
  footR: 'shinR',
}

const bi = (b: BoneName) => BONES.indexOf(b)
type Weights = [BoneName, number][]

/** Bake color, material id and skin weights into a geometry (non-indexed, ready to merge). */
function finish(
  g: BufferGeometry,
  color: Color | ((p: Vector3) => Color),
  mat: Mat | ((p: Vector3) => Mat),
  weights: Weights | ((p: Vector3) => Weights),
): BufferGeometry {
  if (!g.getAttribute('normal')) g.computeVertexNormals()
  const geo = g.index ? g.toNonIndexed() : g
  geo.deleteAttribute('uv')
  const pos = geo.getAttribute('position')
  const n = pos.count
  const col = new Float32Array(n * 3)
  const mats = new Float32Array(n)
  const si = new Uint16Array(n * 4)
  const sw = new Float32Array(n * 4)
  const p = new Vector3()
  for (let i = 0; i < n; i++) {
    p.fromBufferAttribute(pos, i)
    const c = typeof color === 'function' ? color(p) : color
    col.set([c.r, c.g, c.b], i * 3)
    mats[i] = typeof mat === 'function' ? mat(p) : mat
    const w = typeof weights === 'function' ? weights(p) : weights
    w.slice(0, 4).forEach(([b, v], k) => {
      si[i * 4 + k] = bi(b)
      sw[i * 4 + k] = v
    })
  }
  geo.setAttribute('color', new Float32BufferAttribute(col, 3))
  geo.setAttribute('aMat', new Float32BufferAttribute(mats, 1))
  geo.setAttribute('skinIndex', new Uint16BufferAttribute(si, 4))
  geo.setAttribute('skinWeight', new Float32BufferAttribute(sw, 4))
  return geo
}

interface Ring {
  x: number
  y: number
  z: number
  rx: number
  rz: number
  /** Front (+z) / back (-z) bulge factors. */
  front?: number
  back?: number
  w: Weights
}

/** Smooth tube through rings (Catmull-Rom interpolated), capped at both ends. Rings are horizontal. */
function tube(
  keys: Ring[],
  radial = 14,
  sub = 3,
  color: (p: Vector3, ring: number) => Color,
  mat: (p: Vector3, ring: number) => Mat,
) {
  const rings: (Ring & { t: number })[] = []
  const cr = (a: number, b: number, c: number, d: number, t: number) =>
    0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t)
  for (let i = 0; i < keys.length - 1; i++) {
    const k0 = keys[Math.max(0, i - 1)]
    const k1 = keys[i]
    const k2 = keys[i + 1]
    const k3 = keys[Math.min(keys.length - 1, i + 2)]
    for (let s = 0; s < sub; s++) {
      const t = s / sub
      const lerpW: Weights = []
      const map = new Map<BoneName, number>()
      for (const [b, v] of k1.w) map.set(b, (map.get(b) ?? 0) + v * (1 - t))
      for (const [b, v] of k2.w) map.set(b, (map.get(b) ?? 0) + v * t)
      map.forEach((v, b) => lerpW.push([b, v]))
      rings.push({
        x: cr(k0.x, k1.x, k2.x, k3.x, t),
        y: cr(k0.y, k1.y, k2.y, k3.y, t),
        z: cr(k0.z, k1.z, k2.z, k3.z, t),
        rx: Math.max(0.005, cr(k0.rx, k1.rx, k2.rx, k3.rx, t)),
        rz: Math.max(0.005, cr(k0.rz, k1.rz, k2.rz, k3.rz, t)),
        front: (k1.front ?? 1) * (1 - t) + (k2.front ?? 1) * t,
        back: (k1.back ?? 1) * (1 - t) + (k2.back ?? 1) * t,
        w: lerpW,
        t: i + t,
      })
    }
  }
  const last = keys[keys.length - 1]
  rings.push({ ...last, t: keys.length - 1 })
  const pos: number[] = []
  const idx: number[] = []
  rings.forEach((r) => {
    for (let j = 0; j < radial; j++) {
      const a = (j / radial) * Math.PI * 2
      const sz = Math.sin(a)
      const bulge = sz > 0 ? (r.front ?? 1) : (r.back ?? 1)
      pos.push(r.x + Math.cos(a) * r.rx, r.y, r.z + sz * r.rz * bulge)
    }
  })
  for (let i = 0; i < rings.length - 1; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * radial + j
      const b = i * radial + ((j + 1) % radial)
      const c = (i + 1) * radial + ((j + 1) % radial)
      const d = (i + 1) * radial + j
      // Orientation depends on whether rings go up or down.
      if (rings[i + 1].y > rings[i].y) idx.push(a, d, c, a, c, b)
      else idx.push(a, b, c, a, c, d)
    }
  }
  // Caps
  const capIdx = (ring: number, down: boolean) => {
    const r = rings[ring]
    const center = pos.length / 3
    pos.push(r.x, r.y + (down ? -0.005 : 0.005), r.z)
    for (let j = 0; j < radial; j++) {
      const a = ring * radial + j
      const b = ring * radial + ((j + 1) % radial)
      if (down) idx.push(center, a, b)
      else idx.push(center, b, a)
    }
  }
  const ascending = rings[1].y > rings[0].y
  capIdx(0, ascending)
  capIdx(rings.length - 1, !ascending)
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  // Per-vertex data from the closest ring (by height).
  const ringOf = (p: Vector3) => {
    let best = 0
    let bd = Infinity
    rings.forEach((r, i) => {
      const d = Math.abs(r.y - p.y)
      if (d < bd) {
        bd = d
        best = i
      }
    })
    return best
  }
  return finish(
    g,
    (p) => color(p, rings[ringOf(p)].t),
    (p) => mat(p, rings[ringOf(p)].t),
    (p) => rings[ringOf(p)].w,
  )
}

function sphere(r: number, sx: number, sy: number, sz: number, x: number, y: number, z: number, seg = 16) {
  return new SphereGeometry(r, seg, Math.max(6, Math.round(seg * 0.7))).scale(sx, sy, sz).translate(x, y, z)
}

function buildParts(look: CharacterLook, joint: (b: BoneName) => Vector3): BufferGeometry[] {
  const s = look.height
  const w = look.build
  const fem = look.feminine
  const parts: BufferGeometry[] = []
  const skin = look.skin
  const lip = skin.clone().lerp(new Color('#a8504a'), fem ? 0.45 : 0.25)
  const torsoTop = look.vest ?? look.shirt

  // --- Torso (pelvis → neck base)
  const hy = joint('hips').y
  const sy = joint('spine').y
  const cy = joint('chest').y
  const ny = joint('neck').y
  const belt = sy - 0.02 * s
  const tw = w * (fem ? 0.92 : 1)
  // Only the neck opening shows skin; the rest of the torso is clothed.
  const isSkin = (p: Vector3) => p.y > ny + 0.012 * s && Math.abs(p.x) < 0.07
  parts.push(
    tube(
      [
        { x: 0, y: hy - 0.065 * s, z: -0.01, rx: 0.1 * tw, rz: 0.06 * w, w: [['hips', 1]] },
        {
          x: 0,
          y: hy - 0.04 * s,
          z: -0.01,
          rx: (fem ? 0.172 : 0.158) * tw,
          rz: 0.105 * w,
          back: 1.2,
          w: [['hips', 1]],
        },
        {
          x: 0,
          y: belt,
          z: 0,
          rx: (fem ? 0.15 : 0.152) * tw,
          rz: 0.1 * w,
          back: 1.05,
          w: [
            ['hips', 0.6],
            ['spine', 0.4],
          ],
        },
        { x: 0, y: sy + 0.07 * s, z: 0, rx: (fem ? 0.128 : 0.145) * tw, rz: 0.095 * w, w: [['spine', 1]] },
        {
          x: 0,
          y: cy,
          z: 0.005,
          rx: 0.158 * tw,
          rz: 0.105 * w,
          front: fem ? 1.15 : 1.05,
          w: [
            ['spine', 0.5],
            ['chest', 0.5],
          ],
        },
        { x: 0, y: cy + 0.1 * s, z: 0.01, rx: 0.175 * tw, rz: 0.118 * w, front: fem ? 1.3 : 1.1, w: [['chest', 1]] },
        { x: 0, y: cy + 0.205 * s, z: 0, rx: (fem ? 0.168 : 0.192) * tw, rz: 0.105 * w, w: [['chest', 1]] },
        {
          x: 0,
          y: ny - 0.025 * s,
          z: -0.012,
          rx: 0.15 * tw,
          rz: 0.085 * w,
          w: [
            ['chest', 0.9],
            ['neck', 0.1],
          ],
        },
        {
          x: 0,
          y: ny + 0.005 * s,
          z: -0.008,
          rx: 0.08,
          rz: 0.065,
          w: [
            ['chest', 0.5],
            ['neck', 0.5],
          ],
        },
        {
          x: 0,
          y: ny + 0.02 * s,
          z: -0.005,
          rx: 0.062,
          rz: 0.058,
          w: [
            ['chest', 0.3],
            ['neck', 0.7],
          ],
        },
      ],
      18,
      3,
      (p) => (p.y < belt - 0.025 ? look.pants : p.y < belt + 0.02 ? new Color('#1a1410') : isSkin(p) ? skin : torsoTop),
      (p) => (isSkin(p) ? Mat.Skin : p.y < belt + 0.02 && p.y > belt - 0.025 ? Mat.Leather : Mat.Cloth),
    ),
  )
  // Shoulder caps (deltoids)
  for (const side of ['L', 'R'] as const) {
    const sx = side === 'L' ? 1 : -1
    const a = joint(`upperArm${side}`)
    parts.push(
      finish(sphere(0.066 * w, 1, 0.95, 1.05, a.x - sx * 0.012, a.y - 0.015, a.z, 14), look.shirt, Mat.Cloth, [
        [`upperArm${side}`, 0.6],
        ['chest', 0.4],
      ]),
    )
  }

  // --- Neck
  const hdy = joint('head').y
  parts.push(
    tube(
      [
        { x: 0, y: ny - 0.02, z: -0.008, rx: fem ? 0.056 : 0.062, rz: fem ? 0.054 : 0.058, w: [['neck', 1]] },
        {
          x: 0,
          y: hdy + 0.03,
          z: -0.004,
          rx: fem ? 0.051 : 0.055,
          rz: fem ? 0.05 : 0.054,
          w: [
            ['neck', 0.4],
            ['head', 0.6],
          ],
        },
      ],
      12,
      2,
      () => skin,
      () => Mat.Skin,
    ),
  )

  // --- Head
  const H: Weights = [['head', 1]]
  const hc = hdy + 0.11 * s
  const hs = s * (fem ? 0.97 : 1)
  parts.push(finish(sphere(0.105 * hs, 0.9, 1.1, 1.0, 0, hc, -0.005, 22), skin, Mat.Skin, H))
  parts.push(finish(sphere(0.082 * hs, 0.88, 0.78, 1.0, 0, hc - 0.058 * hs, 0.022, 18), skin, Mat.Skin, H)) // jaw
  parts.push(finish(sphere(0.03 * hs, 1.6, 0.6, 0.9, 0, hc - 0.095 * hs, 0.055, 12), skin, Mat.Skin, H)) // chin
  parts.push(
    finish(
      sphere(0.0105, 0.85, 2.1, 0.9, 0, 0, 0, 12)
        .rotateX(-0.25)
        .translate(0, hc - 0.01, 0.094 * hs),
      skin,
      Mat.Skin,
      H,
    ),
  ) // nose bridge
  parts.push(finish(sphere(0.0135, 1.1, 0.85, 0.95, 0, hc - 0.031, 0.1 * hs, 12), skin, Mat.Skin, H)) // nose tip
  for (const sx of [-1, 1])
    parts.push(
      finish(
        sphere(0.009, 1, 0.8, 1, sx * 0.012, hc - 0.034, 0.093 * hs, 10),
        skin.clone().multiplyScalar(0.96),
        Mat.Skin,
        H,
      ),
    ) // alae
  for (const sx of [-1, 1]) {
    const ex = sx * 0.036 * hs
    const ey = hc + 0.012
    parts.push(finish(sphere(0.0135, 1, 0.75, 1, ex, ey, 0.086 * hs, 12), new Color('#f2efe8'), Mat.EyeWhite, H))
    parts.push(finish(sphere(0.0072, 1, 1, 0.5, ex, ey, 0.0985 * hs, 10), look.eyes, Mat.Iris, H))
    parts.push(finish(sphere(0.0032, 1, 1, 0.5, ex, ey, 0.1015 * hs, 6), new Color('#050505'), Mat.Iris, H))
    parts.push(
      finish(
        sphere(0.017, 1.2, 0.35, 0.6, ex, ey + 0.012, 0.09 * hs, 10),
        skin.clone().multiplyScalar(0.9),
        Mat.Skin,
        H,
      ),
    ) // eyelid
    parts.push(
      finish(
        sphere(0.019, 1.4, 0.28, 0.5, 0, 0, 0, 8)
          .rotateZ(-sx * 0.12)
          .translate(ex, ey + 0.026, 0.093 * hs),
        look.hair.clone().multiplyScalar(0.9),
        Mat.Hair,
        H,
      ),
    ) // brow
    parts.push(finish(sphere(0.024, 0.45, 1, 0.7, sx * 0.094 * hs, hc - 0.005, -0.005, 10), skin, Mat.Skin, H)) // ear
    parts.push(
      finish(
        sphere(0.026, 1, 0.75, 0.5, sx * 0.046 * hs, hc - 0.02, 0.062 * hs, 10),
        skin.clone().lerp(new Color('#c0605a'), 0.05),
        Mat.Skin,
        H,
      ),
    ) // cheekbone
  }
  parts.push(finish(sphere(0.021, 1.25, 0.3, 0.45, 0, hc - 0.056, 0.101 * hs, 12), lip, Mat.Skin, H)) // upper lip
  parts.push(finish(sphere(0.019, 1.2, 0.34, 0.45, 0, hc - 0.066, 0.098 * hs, 12), lip, Mat.Skin, H)) // lower lip
  // Hair
  if (look.hairStyle !== 'bald' && !look.hat) {
    const hair = sphere(0.112 * hs, 0.92, 1.08, 1.04, 0, hc + 0.006, -0.012, 22)
    const pos = hair.getAttribute('position')
    const v = new Vector3()
    const long = look.hairStyle === 'long'
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i)
      const ly = v.y - hc
      const lz = v.z
      // Hairline: high on the forehead, low on the back of the head.
      const line = lz > 0.03 ? 0.045 : long ? -0.13 : -0.05 + Math.max(0, -lz) * 0.4
      const sideFace = lz > 0.0 && Math.abs(v.x) < 0.09 && ly < 0.03
      if (ly < line || sideFace) v.set(v.x * 0.85, hc + (ly < -0.1 ? -0.02 : ly) * 0.9, lz * 0.85)
      if (look.hairStyle === 'buzz') v.set(v.x * 0.965, hc + (v.y - hc) * 0.97, v.z * 0.965)
      pos.setXYZ(i, v.x, v.y, v.z)
    }
    hair.computeVertexNormals()
    parts.push(finish(hair, look.hair, Mat.Hair, H))
    if (long)
      parts.push(
        finish(sphere(0.1, 1.05, 1.4, 0.45, 0, hc - 0.08, -0.07, 16), look.hair, Mat.Hair, [
          ['head', 0.7],
          ['neck', 0.3],
        ]),
      )
    if (look.hairStyle === 'curly') {
      for (let k = 0; k < 30; k++) {
        const a = (k / 30) * Math.PI * 2 * 1.618 * 3
        const r = 0.06 + (k % 3) * 0.012
        parts.push(
          finish(
            sphere(
              0.022,
              1,
              1,
              1,
              Math.cos(a) * r,
              hc + 0.075 + Math.sin(k * 1.7) * 0.025 - (k % 3) * 0.01,
              Math.sin(a) * r - 0.015,
              8,
            ),
            look.hair,
            Mat.Hair,
            H,
          ),
        )
      }
    }
  }
  if (look.hat) {
    parts.push(
      finish(new CylinderGeometry(0.106, 0.112, 0.07, 18).translate(0, hc + 0.08, -0.005), look.hat, Mat.Cloth, H),
    )
    parts.push(finish(sphere(0.108, 1, 0.45, 1.02, 0, hc + 0.112, -0.005, 16), look.hat, Mat.Cloth, H))
    parts.push(
      finish(
        new CylinderGeometry(0.075, 0.075, 0.012, 14, 1, false, -Math.PI / 2, Math.PI)
          .scale(1, 1, 1.2)
          .translate(0, hc + 0.05, 0.075),
        new Color('#0b0b0b'),
        Mat.Leather,
        H,
      ),
    )
  }

  // --- Arms
  for (const side of ['L', 'R'] as const) {
    const ua = joint(`upperArm${side}`)
    const fa = joint(`foreArm${side}`)
    const ha = joint(`hand${side}`)
    const x = ua.x
    const UA = `upperArm${side}` as BoneName
    const FA = `foreArm${side}` as BoneName
    const HA = `hand${side}` as BoneName
    const m = fem ? 0.88 : 1
    const sleeveEnd = look.shortSleeves ? ua.y - 0.12 * s : ha.y + 0.03
    parts.push(
      tube(
        [
          {
            x,
            y: ua.y + 0.02,
            z: 0,
            rx: 0.056 * w * m,
            rz: 0.06 * w * m,
            w: [
              [UA, 0.6],
              ['chest', 0.4],
            ],
          },
          { x, y: ua.y - 0.06 * s, z: 0, rx: 0.054 * w * m, rz: 0.056 * w * m, w: [[UA, 1]] },
          { x, y: ua.y - 0.17 * s, z: -0.002, rx: 0.047 * w * m, rz: 0.05 * w * m, back: 1.08, w: [[UA, 1]] },
          {
            x,
            y: fa.y + 0.02,
            z: -0.004,
            rx: 0.04 * w * m,
            rz: 0.042 * w * m,
            w: [
              [UA, 0.6],
              [FA, 0.4],
            ],
          },
          {
            x,
            y: fa.y - 0.03,
            z: 0,
            rx: 0.041 * w * m,
            rz: 0.043 * w * m,
            w: [
              [UA, 0.3],
              [FA, 0.7],
            ],
          },
          { x, y: fa.y - 0.09 * s, z: 0.003, rx: 0.042 * w * m, rz: 0.044 * w * m, w: [[FA, 1]] },
          { x, y: ha.y + 0.035, z: 0, rx: 0.03 * m, rz: 0.024 * m, w: [[FA, 1]] },
          {
            x,
            y: ha.y + 0.005,
            z: 0,
            rx: 0.029 * m,
            rz: 0.023 * m,
            w: [
              [FA, 0.5],
              [HA, 0.5],
            ],
          },
        ],
        12,
        3,
        (p) => (p.y > sleeveEnd ? look.shirt : skin),
        (p) => (p.y > sleeveEnd ? Mat.Cloth : Mat.Skin),
      ),
    )
    // Sleeve cuff
    parts.push(
      finish(
        new CylinderGeometry(0.05 * w * m, 0.05 * w * m, 0.015, 12, 1, true).translate(x, sleeveEnd, 0),
        look.shirt.clone().multiplyScalar(0.85),
        Mat.Cloth,
        look.shortSleeves ? [[UA, 1]] : [[FA, 1]],
      ),
    )
    // Hand: palm + fingers (mitten with knuckle bulge) + thumb
    const sx = side === 'L' ? 1 : -1
    parts.push(finish(sphere(0.045, 0.42, 1.0, 0.95, x, ha.y - 0.045, 0.0, 12), skin, Mat.Skin, [[HA, 1]]))
    parts.push(
      finish(
        new CapsuleGeometry(0.022, 0.06, 4, 8).scale(0.8, 1, 1.75).translate(x, ha.y - 0.115, 0.003),
        skin,
        Mat.Skin,
        [[HA, 1]],
      ),
    )
    parts.push(
      finish(
        new CapsuleGeometry(0.012, 0.035, 4, 6)
          .rotateX(-0.6)
          .rotateZ(-sx * 0.35)
          .translate(x - sx * 0.012, ha.y - 0.06, 0.04),
        skin,
        Mat.Skin,
        [[HA, 1]],
      ),
    )
  }

  // --- Legs
  for (const side of ['L', 'R'] as const) {
    const th = joint(`thigh${side}`)
    const sh = joint(`shin${side}`)
    const ft = joint(`foot${side}`)
    const x = th.x
    const TH = `thigh${side}` as BoneName
    const SH = `shin${side}` as BoneName
    const FT = `foot${side}` as BoneName
    const lw = w * (fem ? 1.03 : 1)
    parts.push(
      tube(
        [
          {
            x: x * 0.9,
            y: th.y + 0.06,
            z: 0,
            rx: 0.095 * lw,
            rz: 0.1 * lw,
            w: [
              ['hips', 0.7],
              [TH, 0.3],
            ],
          },
          {
            x,
            y: th.y - 0.05 * s,
            z: 0,
            rx: 0.09 * lw,
            rz: 0.095 * lw,
            w: [
              ['hips', 0.25],
              [TH, 0.75],
            ],
          },
          { x, y: th.y - 0.22 * s, z: 0.003, rx: 0.077 * lw, rz: 0.08 * lw, front: 1.08, w: [[TH, 1]] },
          {
            x,
            y: sh.y + 0.05,
            z: 0.005,
            rx: 0.06 * lw,
            rz: 0.064 * lw,
            w: [
              [TH, 0.8],
              [SH, 0.2],
            ],
          },
          {
            x,
            y: sh.y - 0.01,
            z: 0.006,
            rx: 0.058 * lw,
            rz: 0.063 * lw,
            front: 1.1,
            w: [
              [TH, 0.45],
              [SH, 0.55],
            ],
          },
          { x, y: sh.y - 0.12 * s, z: -0.006, rx: 0.06 * lw, rz: 0.066 * lw, back: 1.25, w: [[SH, 1]] },
          { x, y: ft.y + 0.12 * s, z: 0, rx: 0.045 * lw, rz: 0.046 * lw, w: [[SH, 1]] },
          {
            x,
            y: ft.y + 0.035,
            z: 0,
            rx: 0.04,
            rz: 0.042,
            w: [
              [SH, 0.6],
              [FT, 0.4],
            ],
          },
        ],
        14,
        3,
        () => look.pants,
        () => Mat.Cloth,
      ),
    )
    // Shoe: rounded upper + sole
    parts.push(finish(sphere(0.06, 0.95, 0.62, 1.95, x, ft.y - 0.005, 0.045, 16), look.shoes, Mat.Leather, [[FT, 1]]))
    parts.push(
      finish(
        new CapsuleGeometry(0.052, 0.13, 4, 10)
          .rotateX(Math.PI / 2)
          .scale(1.05, 0.28, 1)
          .translate(x, ft.y - 0.035, 0.048),
        new Color('#e8e4dc').lerp(look.shoes, 0.6),
        Mat.Leather,
        [[FT, 1]],
      ),
    )
  }
  return parts
}

export interface CharacterRig {
  /** Root object to place in the world (feet at origin, facing +Z). */
  object: Group
  mesh: SkinnedMesh
  bones: Record<BoneName, Bone>
  /** Rest-pose local positions (hips height changes when crouching). */
  rest: Record<BoneName, [number, number, number]>
  look: CharacterLook
}

/** Single-draw-call SkinnedMesh: anatomical tubes with blended joint weights, modelled head and face. */
export function buildCharacter(look: CharacterLook): CharacterRig {
  const rest = restOffsets(look)
  const bones = {} as Record<BoneName, Bone>
  for (const name of BONES) {
    const b = new Bone()
    b.name = name
    b.position.set(...rest[name])
    bones[name] = b
  }
  for (const name of BONES) {
    const p = PARENT[name]
    if (p) bones[p].add(bones[name])
  }
  bones.root.updateMatrixWorld(true)
  const joint = (b: BoneName) => new Vector3().setFromMatrixPosition(bones[b].matrixWorld)

  const parts = buildParts(look, joint)
  const geometry = mergeGeometries(parts)!
  parts.forEach((g) => g.dispose())
  geometry.computeBoundingSphere()

  const mesh = new SkinnedMesh(geometry, characterMaterial)
  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.frustumCulled = false
  mesh.add(bones.root)
  mesh.bind(new Skeleton(BONES.map((n) => bones[n])), new Matrix4())

  const object = new Group()
  object.add(mesh)
  return { object, mesh, bones, rest, look }
}

export function disposeCharacter(rig: CharacterRig) {
  rig.mesh.geometry.dispose()
  rig.mesh.skeleton.dispose()
  rig.object.removeFromParent()
}
