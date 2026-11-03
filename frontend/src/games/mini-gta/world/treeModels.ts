import {
  BufferGeometry,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { Rng } from '../core/rng'
import { ATLAS, foliageAtlas } from '../render/foliageTexture'
import { sharedUniforms } from '../render/materials'

export type Species = 'oak' | 'conifer' | 'palm'

export interface TreeModel {
  bark: BufferGeometry
  leaves: BufferGeometry
}

type Col = [number, number, number]

function colored(g: BufferGeometry, c: Col) {
  const geo = g.index ? g.toNonIndexed() : g
  geo.deleteAttribute('uv')
  const n = geo.getAttribute('position').count
  const arr = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) arr.set(c, i * 3)
  geo.setAttribute('color', new Float32BufferAttribute(arr, 3))
  return geo
}

/** Tapered limb from a to b (radii r0 → r1). */
function limb(a: Vector3, b: Vector3, r0: number, r1: number, c: Col, seg = 5) {
  const dir = b.clone().sub(a)
  const len = dir.length()
  const g = new CylinderGeometry(r1, r0, len, seg, 1, true)
  g.translate(0, len / 2, 0)
  const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir.normalize())
  g.applyMatrix4(new Matrix4().makeRotationFromQuaternion(q))
  g.translate(a.x, a.y, a.z)
  return colored(g, c)
}

/**
 * Leaf cards. Normals point away from the crown center (volumetric lighting trick),
 * `aSway` = how much the vertex moves in the wind.
 */
class Cards {
  pos: number[] = []
  nor: number[] = []
  uv: number[] = []
  col: number[] = []
  sway: number[] = []

  add(center: Vector3, crown: Vector3, size: number, rng: Rng, region: typeof ATLAS.leaf, up?: Vector3, tint = 1) {
    const n = center.clone().sub(crown).normalize()
    // Random orientation, biased to face outward.
    const a = up ?? new Vector3(rng.range(-1, 1), rng.range(-0.3, 1), rng.range(-1, 1)).normalize()
    const right = new Vector3().crossVectors(a, n).normalize()
    if (right.lengthSq() < 0.01) right.set(1, 0, 0)
    const upv = new Vector3().crossVectors(n, right).normalize()
    const h = size / 2
    const corners = [
      center.clone().addScaledVector(right, -h).addScaledVector(upv, -h),
      center.clone().addScaledVector(right, h).addScaledVector(upv, -h),
      center.clone().addScaledVector(right, h).addScaledVector(upv, h),
      center.clone().addScaledVector(right, -h).addScaledVector(upv, h),
    ]
    const uvs = [
      [region.u0, region.v0],
      [region.u1, region.v0],
      [region.u1, region.v1],
      [region.u0, region.v1],
    ]
    const t = tint * rng.range(0.85, 1.12)
    for (const k of [0, 1, 2, 0, 2, 3]) {
      const p = corners[k]
      const nn = p.clone().sub(crown).normalize()
      this.pos.push(p.x, p.y, p.z)
      this.nor.push(nn.x, nn.y, nn.z)
      this.uv.push(uvs[k][0], uvs[k][1])
      this.col.push(t, t, t * 0.95)
      this.sway.push(Math.min(1, Math.max(0, p.y / 10)))
    }
  }

  /** A bent strip (palm frond) made of segments along a curve. */
  strip(points: Vector3[], width: number, side: Vector3, region: typeof ATLAS.frond, crown: Vector3) {
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i]
      const p1 = points[i + 1]
      const u0 = region.u0 + (region.u1 - region.u0) * (i / (points.length - 1))
      const u1 = region.u0 + (region.u1 - region.u0) * ((i + 1) / (points.length - 1))
      const w0 = width * Math.sin(((i + 0.5) / points.length) * Math.PI) + 0.1
      const w1 = width * Math.sin(((i + 1.5) / points.length) * Math.PI) + 0.1
      const c = [
        p0.clone().addScaledVector(side, -w0),
        p1.clone().addScaledVector(side, -w1),
        p1.clone().addScaledVector(side, w1),
        p0.clone().addScaledVector(side, w0),
      ]
      const uvs = [
        [u0, region.v0],
        [u1, region.v0],
        [u1, region.v1],
        [u0, region.v1],
      ]
      for (const k of [0, 1, 2, 0, 2, 3]) {
        const p = c[k]
        const nn = p.clone().sub(crown).normalize()
        nn.y = Math.max(nn.y, 0.3)
        nn.normalize()
        this.pos.push(p.x, p.y, p.z)
        this.nor.push(nn.x, nn.y, nn.z)
        this.uv.push(uvs[k][0], uvs[k][1])
        this.col.push(1, 1, 0.95)
        this.sway.push(Math.min(1, i / (points.length - 1)))
      }
    }
  }

  build() {
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(this.pos, 3))
    g.setAttribute('normal', new Float32BufferAttribute(this.nor, 3))
    g.setAttribute('uv', new Float32BufferAttribute(this.uv, 2))
    g.setAttribute('color', new Float32BufferAttribute(this.col, 3))
    g.setAttribute('aSway', new Float32BufferAttribute(this.sway, 1))
    g.computeBoundingSphere()
    return g
  }
}

function oak(rng: Rng): TreeModel {
  const bark: BufferGeometry[] = []
  const BARK: Col = [0.3, 0.24, 0.19]
  const H = rng.range(2.6, 3.6)
  const lean = new Vector3(rng.range(-0.25, 0.25), 0, rng.range(-0.25, 0.25))
  const top = new Vector3(lean.x, H, lean.z)
  bark.push(limb(new Vector3(0, -0.2, 0), top, rng.range(0.2, 0.26), 0.13, BARK, 7))
  const crown = new Vector3(lean.x, H + rng.range(1.6, 2.3), lean.z)
  const R = rng.range(2.2, 3.0)
  const cards = new Cards()
  const branches = rng.int(4, 6)
  for (let b = 0; b < branches; b++) {
    const a = (b / branches) * Math.PI * 2 + rng.range(-0.3, 0.3)
    const start = top.clone().add(new Vector3(0, rng.range(-0.6, 0.2), 0))
    const end = crown.clone().add(new Vector3(Math.cos(a) * R * 0.75, rng.range(-0.6, 1.0), Math.sin(a) * R * 0.75))
    bark.push(limb(start, end, 0.11, 0.035, BARK))
    // Twigs
    for (let t = 0; t < 1; t++) {
      const mid = start.clone().lerp(end, rng.range(0.4, 0.8))
      const tip = mid.clone().add(new Vector3(rng.range(-1.2, 1.2), rng.range(0.2, 1.2), rng.range(-1.2, 1.2)))
      bark.push(limb(mid, tip, 0.04, 0.015, BARK, 3))
    }
  }
  // Foliage: dense shell around the crown + clusters near branch tips.
  for (let i = 0; i < 150; i++) {
    const d = new Vector3(rng.range(-1, 1), rng.range(-0.6, 1), rng.range(-1, 1)).normalize()
    const r = R * Math.pow(rng.next(), 0.35)
    const p = crown.clone().add(new Vector3(d.x * r, d.y * r * 0.75, d.z * r))
    cards.add(p, crown, rng.range(1.1, 1.7), rng, ATLAS.leaf, undefined, 0.75 + 0.35 * (r / R))
  }
  return { bark: mergeGeometries(bark)!, leaves: cards.build() }
}

function conifer(rng: Rng): TreeModel {
  const BARK: Col = [0.26, 0.19, 0.14]
  const H = rng.range(9, 13)
  const bark = [limb(new Vector3(0, -0.3, 0), new Vector3(0, H, 0), rng.range(0.22, 0.3), 0.04, BARK, 6)]
  const cards = new Cards()
  const layers = 14
  for (let l = 0; l < layers; l++) {
    const t = l / (layers - 1)
    const y = H * (0.22 + 0.76 * t)
    const radius = (1 - t) * rng.range(2.4, 3.0) + 0.3
    const count = Math.round(5 + (1 - t) * 7)
    for (let k = 0; k < count; k++) {
      const a = (k / count) * Math.PI * 2 + rng.range(-0.3, 0.3) + l * 0.7
      const out = new Vector3(Math.cos(a), -0.35, Math.sin(a)).normalize()
      const center = new Vector3(Math.cos(a) * radius * 0.55, y - radius * 0.15, Math.sin(a) * radius * 0.55)
      // Card plane contains the outward direction (branch hanging out of the trunk).
      cards.add(center, new Vector3(0, y + 1.5, 0), radius * 1.15 + 0.6, rng, ATLAS.conifer, out, 0.85 + 0.25 * t)
    }
  }
  return { bark: mergeGeometries(bark)!, leaves: cards.build() }
}

function palm(rng: Rng): TreeModel {
  const BARK: Col = [0.47, 0.39, 0.28]
  const H = rng.range(6.5, 8.5)
  const bend = new Vector3(rng.range(-1.2, 1.2), 0, rng.range(-1.2, 1.2))
  const bark: BufferGeometry[] = []
  const segs = 8
  let prev = new Vector3(0, -0.2, 0)
  for (let i = 1; i <= segs; i++) {
    const t = i / segs
    const p = new Vector3(bend.x * t * t, H * t, bend.z * t * t)
    bark.push(limb(prev, p, 0.24 - 0.08 * (t - 1 / segs), 0.24 - 0.08 * t, i % 2 ? BARK : [0.42, 0.34, 0.24], 7))
    prev = p
  }
  const top = prev
  const cards = new Cards()
  const fronds = rng.int(9, 12)
  for (let f = 0; f < fronds; f++) {
    const a = (f / fronds) * Math.PI * 2 + rng.range(-0.2, 0.2)
    const dir = new Vector3(Math.cos(a), 0, Math.sin(a))
    const side = new Vector3(-dir.z, 0, dir.x)
    const len = rng.range(3.2, 4.2)
    const rise = rng.range(0.4, 1.2)
    const pts: Vector3[] = []
    for (let k = 0; k <= 6; k++) {
      const t = k / 6
      pts.push(
        top
          .clone()
          .addScaledVector(dir, len * t)
          .add(new Vector3(0, rise * Math.sin(t * Math.PI * 0.6) - t * t * 2.2, 0)),
      )
    }
    cards.strip(pts, rng.range(0.55, 0.75), side, ATLAS.frond, top.clone().add(new Vector3(0, -0.5, 0)))
  }
  return { bark: mergeGeometries(bark)!, leaves: cards.build() }
}

const cache = new Map<string, TreeModel>()
export const TREE_VARIANTS: Record<Species, number> = { oak: 4, conifer: 3, palm: 2 }

export function treeModel(species: Species, variant: number): TreeModel {
  const key = `${species}:${variant}`
  let m = cache.get(key)
  if (!m) {
    const rng = new Rng(9000 + variant * 31 + species.length * 7)
    m = species === 'oak' ? oak(rng) : species === 'conifer' ? conifer(rng) : palm(rng)
    cache.set(key, m)
  }
  return m
}

/** Bark: vertex color + vertical furrows and noise. */
export const barkMaterial = (() => {
  const m = new MeshStandardMaterial({ vertexColors: true, roughness: 0.95 })
  m.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vBark;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBark = position;')
    s.fragmentShader = s.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vBark;\nfloat bh(vec2 p){return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453);}',
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float ang = atan(vBark.z, vBark.x);
        float furrow = abs(sin(ang * 9.0 + bh(vec2(floor(vBark.y * 3.0))) * 2.0));
        float n = bh(floor(vec2(ang * 20.0, vBark.y * 14.0)));
        diffuseColor.rgb *= 0.65 + 0.35 * furrow + 0.12 * n;`,
      )
  }
  m.customProgramCacheKey = () => 'bark'
  return m
})()

/** Leaves: alpha-tested atlas, wind sway, translucency when back-lit. */
export const leafMaterial = (() => {
  const m = new MeshStandardMaterial({
    map: foliageAtlas(),
    alphaTest: 0.45,
    side: DoubleSide,
    vertexColors: true,
    roughness: 0.75,
    metalness: 0,
  })
  m.onBeforeCompile = (s) => {
    s.uniforms.uTime = sharedUniforms.uTime
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nattribute float aSway;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          vec3 ip = vec3(0.0);
          #ifdef USE_INSTANCING
            ip = instanceMatrix[3].xyz;
          #endif
          float ph = uTime * 1.6 + ip.x * 0.37 + ip.z * 0.21;
          float gust = 0.6 + 0.4 * sin(uTime * 0.37 + ip.x * 0.05);
          transformed.x += sin(ph + position.y * 0.6) * 0.09 * aSway * gust;
          transformed.z += cos(ph * 1.3 + position.x) * 0.07 * aSway * gust;
          transformed.y += sin(ph * 2.1 + position.z * 2.0) * 0.03 * aSway;
        }`,
      )
    s.fragmentShader = s.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
      // Light through leaves (cheap translucency) + ambient boost on the shaded side.
      totalEmissiveRadiance += diffuseColor.rgb * 0.06;`,
    )
  }
  m.customProgramCacheKey = () => 'leaves'
  return m
})()
