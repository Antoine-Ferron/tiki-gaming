import { BufferGeometry } from 'three'
import { Rng } from '../core/rng'
import { GeoBuilder, type V3 } from '../render/GeoBuilder'
import { FacadeStyle, type Building, type CityData } from './city'
import {
  AIRFIELD,
  CHUNK_SIZE,
  MAP_HALF,
  RING,
  SIDEWALK_WIDTH,
  SLAB_HEIGHT,
  TERRAIN_RES,
  chunkIndexOf,
  shoreX,
} from './constants'

export interface ChunkGeometries {
  terrain: BufferGeometry | null
  road: BufferGeometry | null
  pavement: BufferGeometry | null
  buildings: BufferGeometry | null
  interiors: BufferGeometry | null
}

const ROAD_Y = 0.03

/** Pre-computed road ribbons (quads assigned to chunks by midpoint). Built once per city. */
export function buildRoadQuads(city: CityData): Map<number, GeoBuilder> {
  const g = city.roads.graph
  const out = new Map<number, GeoBuilder>()
  const builderFor = (x: number, z: number) => {
    const k = chunkIndexOf(x, z)
    let b = out.get(k)
    if (!b) out.set(k, (b = new GeoBuilder({ aUvM: 2, aInfo: 4 })))
    return b
  }
  const white: V3 = [1, 1, 1]
  const up: V3 = [0, 1, 0]
  const yAt = (x: number, z: number, hill: boolean) => city.terrain.heightAt(x, z) + (hill ? 0.07 : ROAD_Y)

  for (const chain of g.chains()) {
    const nodes = chain.nodes.map((id) => g.nodes[id])
    const pts = nodes.map((n) => ({ x: n.x, z: n.z }))
    const first = nodes[0]
    const last = nodes[nodes.length - 1]
    // Trim ends by the intersection radius.
    const trim = (p: { x: number; z: number }, toward: { x: number; z: number }, r: number) => {
      const d = Math.hypot(toward.x - p.x, toward.z - p.z)
      const t = Math.min(r / d, 0.45)
      return { x: p.x + (toward.x - p.x) * t, z: p.z + (toward.z - p.z) * t }
    }
    if (first.radius > 0) pts[0] = trim(pts[0], pts[1], first.radius)
    if (last.radius > 0 && first.id !== last.id)
      pts[pts.length - 1] = trim(pts[pts.length - 1], pts[pts.length - 2], last.radius)
    const closed = first.id === last.id && first.radius === 0
    const hw = chain.width / 2
    // Miter offsets
    const offs = pts.map((p, i) => {
      const prev = pts[i - 1] ?? (closed ? pts[pts.length - 2] : undefined)
      const next = pts[i + 1] ?? (closed ? pts[1] : undefined)
      const segN = (a: { x: number; z: number }, b: { x: number; z: number }) => {
        const l = Math.hypot(b.x - a.x, b.z - a.z) || 1
        return { x: -(b.z - a.z) / l, z: (b.x - a.x) / l }
      }
      const n1 = prev ? segN(prev, p) : undefined
      const n2 = next ? segN(p, next) : undefined
      const n = n1 && n2 ? { x: n1.x + n2.x, z: n1.z + n2.z } : (n1 ?? n2)!
      const l = Math.hypot(n.x, n.z) || 1
      const nx = n.x / l
      const nz = n.z / l
      const ref = n2 ?? n1!
      const scale = 1 / Math.max(0.5, nx * ref.x + nz * ref.z)
      return { x: nx * hw * scale, z: nz * hw * scale }
    })
    let v = 0
    const total = pts.reduce((acc, p, i) => (i ? acc + Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z) : 0), 0)
    const crossStart = first.light ? 3.2 : -1
    const crossEnd = last.light ? total - 3.2 : 1e9
    const edgeU = chain.lanes * 3.5
    const hill = chain.kind === 'hill'
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i]
      const b = pts[i + 1]
      const len = Math.hypot(b.x - a.x, b.z - a.z)
      // Split long straight segments so heights follow terrain and chunks are balanced.
      const pieces = Math.max(1, Math.ceil(len / 32))
      for (let k = 0; k < pieces; k++) {
        const t0 = k / pieces
        const t1 = (k + 1) / pieces
        const lerpP = (t: number) => ({
          x: a.x + (b.x - a.x) * t,
          z: a.z + (b.z - a.z) * t,
          ox: offs[i].x + (offs[i + 1].x - offs[i].x) * t,
          oz: offs[i].z + (offs[i + 1].z - offs[i].z) * t,
        })
        const p0 = lerpP(t0)
        const p1 = lerpP(t1)
        const v0 = v + len * t0
        const v1 = v + len * t1
        const L: V3[] = [
          [p0.x - p0.ox, 0, p0.z - p0.oz],
          [p1.x - p1.ox, 0, p1.z - p1.oz],
          [p1.x + p1.ox, 0, p1.z + p1.oz],
          [p0.x + p0.ox, 0, p0.z + p0.oz],
        ]
        for (const q of L) q[1] = yAt(q[0], q[2], hill)
        const uv: [number, number][] = [
          [-hw, v0],
          [-hw, v1],
          [hw, v1],
          [hw, v0],
        ]
        const info = [chain.lanes, edgeU, crossStart, crossEnd]
        // Winding: left0, left1, right1, right0 seen from above must be CCW.
        builderFor((p0.x + p1.x) / 2, (p0.z + p1.z) / 2).quad(L[0], L[3], L[2], L[1], up, white, (c) => ({
          aUvM: uv[[0, 3, 2, 1][c]],
          aInfo: info,
        }))
      }
      v += len
    }
  }

  // Intersection patches (plain asphalt).
  for (const n of g.nodes) {
    if (n.radius <= 0) continue
    const b = builderFor(n.x, n.z)
    const info = [0, 0, -1, 1e9]
    const y = (x: number, z: number) => yAt(x, z, !n.square) + 0.01
    if (n.square) {
      const r = n.radius
      const P: V3[] = [
        [n.x - r, 0, n.z + r],
        [n.x + r, 0, n.z + r],
        [n.x + r, 0, n.z - r],
        [n.x - r, 0, n.z - r],
      ]
      for (const p of P) p[1] = y(p[0], p[2])
      b.quad(P[0], P[1], P[2], P[3], up, white, () => ({ aUvM: [0, 0], aInfo: info }))
    } else {
      const r = n.radius * 1.45
      const seg = 14
      const center: V3 = [n.x, y(n.x, n.z), n.z]
      for (let k = 0; k < seg; k++) {
        const a0 = (k / seg) * Math.PI * 2
        const a1 = ((k + 1) / seg) * Math.PI * 2
        const p0: V3 = [n.x + Math.cos(a0) * r, 0, n.z + Math.sin(a0) * r]
        const p1: V3 = [n.x + Math.cos(a1) * r, 0, n.z + Math.sin(a1) * r]
        p0[1] = y(p0[0], p0[2])
        p1[1] = y(p1[0], p1[2])
        b.tri(center, p1, p0, white, () => ({ aUvM: [0, 0], aInfo: info }))
      }
    }
  }

  // Airfield runway (markings via the road shader) + apron.
  const runwayHalf = AIRFIELD.width / 2
  for (let z = AIRFIELD.minZ; z < AIRFIELD.maxZ; z += 40) {
    const z1 = Math.min(AIRFIELD.maxZ, z + 40)
    const x0 = AIRFIELD.runwayX - runwayHalf
    const x1 = AIRFIELD.runwayX + runwayHalf
    const y = ROAD_Y
    builderFor(AIRFIELD.runwayX, (z + z1) / 2).quad(
      [x0, y, z1],
      [x1, y, z1],
      [x1, y, z],
      [x0, y, z],
      up,
      white,
      (c) => ({
        aUvM: [
          [-runwayHalf, z1 - AIRFIELD.minZ],
          [runwayHalf, z1 - AIRFIELD.minZ],
          [runwayHalf, z - AIRFIELD.minZ],
          [-runwayHalf, z - AIRFIELD.minZ],
        ][c],
        aInfo: [1, runwayHalf - 1.5, 30, AIRFIELD.maxZ - AIRFIELD.minZ - 30],
      }),
    )
  }
  return out
}

function terrainColor(x: number, z: number, h: number, slope: number): V3 {
  const insideCity = x > RING.minX - 12 && x < RING.maxX + 12 && z > RING.minZ - 12 && z < RING.maxZ + 12
  const dShore = x - shoreX(z)
  if (h < -0.3) return [0.55, 0.5, 0.38] // seabed
  if (dShore < 45 && !(z > 260 && z < 760)) return [0.86, 0.78, 0.58] // sand
  if (insideCity) return [0.32, 0.33, 0.3]
  if (x > RING.maxX + 10 && Math.abs(x - AIRFIELD.runwayX) < 70 && z > AIRFIELD.minZ - 40 && z < AIRFIELD.maxZ + 40)
    return [0.4, 0.5, 0.3]
  if (slope > 0.55) return [0.45, 0.42, 0.38] // rock
  const t = Math.min(1, Math.max(0, (h - 10) / 60))
  return [0.2 + 0.12 * t, 0.33 - 0.03 * t, 0.12 + 0.05 * t] // grass → dry grass
}

export function buildChunk(city: CityData, index: number, roadQuads: Map<number, GeoBuilder>): ChunkGeometries {
  const cx = index % ((2 * MAP_HALF) / CHUNK_SIZE)
  const cz = Math.floor(index / ((2 * MAP_HALF) / CHUNK_SIZE))
  const x0 = -MAP_HALF + cx * CHUNK_SIZE
  const z0 = -MAP_HALF + cz * CHUNK_SIZE
  const terrain = city.terrain

  // --- Terrain + lawns
  const tb = new GeoBuilder()
  const steps = CHUNK_SIZE / TERRAIN_RES
  const heightAtGrid = (ix: number, iz: number) => terrain.heightAt(x0 + ix * TERRAIN_RES, z0 + iz * TERRAIN_RES)
  const vid: number[] = []
  for (let iz = 0; iz <= steps; iz++) {
    for (let ix = 0; ix <= steps; ix++) {
      const x = x0 + ix * TERRAIN_RES
      const z = z0 + iz * TERRAIN_RES
      const h = heightAtGrid(ix, iz)
      const hx = terrain.heightAt(x + 1, z) - terrain.heightAt(x - 1, z)
      const hz = terrain.heightAt(x, z + 1) - terrain.heightAt(x, z - 1)
      const n: V3 = [-hx / 2, 1, -hz / 2]
      const l = Math.hypot(...n)
      const nn: V3 = [n[0] / l, n[1] / l, n[2] / l]
      vid.push(tb.vertex([x, h, z], nn, terrainColor(x, z, h, 1 - nn[1])))
    }
  }
  const row = steps + 1
  for (let iz = 0; iz < steps; iz++) {
    for (let ix = 0; ix < steps; ix++) {
      const a = vid[iz * row + ix]
      const b = vid[iz * row + ix + 1]
      const c = vid[(iz + 1) * row + ix + 1]
      const d = vid[(iz + 1) * row + ix]
      tb.idx.push(a, d, c, a, c, b)
    }
  }

  // --- Pavement (block slabs, apron, quay) + lawns on top
  const pb = new GeoBuilder()
  const inChunk = (x: number, z: number) => chunkIndexOf(x, z) === index
  const rng = new Rng(city.seed + index)
  const grass: V3 = [0.33, 0.5, 0.24]
  const lawn = (xa: number, xb: number, za: number, zb: number, y = SLAB_HEIGHT + 0.01) => {
    tb.quad([xa, y, zb], [xb, y, zb], [xb, y, za], [xa, y, za], [0, 1, 0], grass)
  }
  for (const block of city.blocks) {
    const bx = (block.x0 + block.x1) / 2
    const bz = (block.z0 + block.z1) / 2
    if (!inChunk(bx, bz)) continue
    const tone = block.district === 'port' ? 0.36 : block.district === 'downtown' ? 0.5 : 0.46
    const c: V3 = [tone, tone * 0.99, tone * 0.96]
    const hy = (SLAB_HEIGHT + 0.3) / 2
    pb.box(bx, SLAB_HEIGHT - hy, bz, (block.x1 - block.x0) / 2, hy, (block.z1 - block.z0) / 2, 0, c, undefined, [3])
    const s = SIDEWALK_WIDTH
    if (block.park) lawn(block.x0 + s, block.x1 - s, block.z0 + s, block.z1 - s)
    else if (block.district === 'suburb') lawn(block.x0 + s, block.x1 - s, block.z0 + s, block.z1 - s)
  }
  // Airfield apron
  if (inChunk(AIRFIELD.apronX, AIRFIELD.apronZ)) {
    const y = ROAD_Y - 0.01
    const ax = AIRFIELD.apronX
    const az = AIRFIELD.apronZ
    pb.quad(
      [ax - 45, y, az + 70],
      [ax + 45, y, az + 70],
      [ax + 45, y, az - 70],
      [ax - 45, y, az - 70],
      [0, 1, 0],
      [0.5, 0.5, 0.5],
    )
  }
  // Promenade along the coast / quay.
  for (let z = RING.minZ + 20; z < RING.maxZ - 20; z += 40) {
    const zc = z + 20
    if (!inChunk(RING.minX - 30, zc)) continue
    const xa = Math.max(shoreX(z), shoreX(z + 40)) + (z > 250 && z < 760 ? 0 : 6)
    const xb = RING.minX - 8.5
    if (xb - xa < 4) continue
    const quay = z > 250 && z < 760
    const t = quay ? 0.42 : 0.62
    const hy = 0.4
    pb.box((xa + xb) / 2, -hy + 0.02, zc, (xb - xa) / 2, hy, 20, 0, [t, t * 0.98, t * 0.95], undefined, [3])
  }

  // --- Buildings
  const bb = new GeoBuilder({ aUvM: 2, aInfo: 2 })
  const ib = new GeoBuilder()
  for (const b of city.buildings) {
    if (b.chunk !== index) continue
    addBuilding(bb, ib, b, rng, streetSide(city, b))
  }

  return {
    terrain: tb.build(),
    road: roadQuads.get(index)?.build() ?? null,
    pavement: pb.build(),
    buildings: bb.build(),
    interiors: ib.build(),
  }
}

const ROOF_COLOR: V3 = [0.42, 0.42, 0.41]

const AWNINGS: V3[] = [
  [0.55, 0.12, 0.1],
  [0.1, 0.3, 0.2],
  [0.12, 0.2, 0.45],
  [0.5, 0.35, 0.1],
  [0.2, 0.2, 0.22],
]

/** Street-facing side of a building (0 -z, 1 +x, 2 +z, 3 -x) from its block. */
function streetSide(city: CityData, b: Building): number {
  const block = city.blocks.find((bl) => b.x > bl.x0 && b.x < bl.x1 && b.z > bl.z0 && b.z < bl.z1)
  if (!block) return 0
  const d = [b.z - b.hd - block.z0, block.x1 - (b.x + b.hw), block.z1 - (b.z + b.hd), b.x - b.hw - block.x0]
  return d.indexOf(Math.min(...d))
}

const SIDE_OUT: [number, number][] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
]

function addBuilding(bb: GeoBuilder, ib: GeoBuilder, b: Building, rng: Rng, side: number) {
  const seed = (b.id * 0.618) % 1
  const color = b.color
  // Facade UV: u along the wall (meters), v height above the base.
  const facadeAttrs =
    (style: number, baseY: number, hw: number, hd: number) =>
    (face: number, _n: V3, _corner: number, world: V3, local: V3) => {
      if (face === 2) return { aUvM: [world[0], world[2]], aInfo: [-1, seed] }
      if (face === 3) return { aUvM: [0, 0], aInfo: [-1, seed] }
      const u = face === 0 || face === 1 ? local[2] + hd : local[0] + hw
      return { aUvM: [u, world[1] - baseY], aInfo: [style, seed] }
    }
  const plain = (style: number) => (face: number, n: V3, _c: number, world: V3) => ({
    aUvM: face === 2 || face === 3 ? [world[0], world[2]] : [Math.abs(n[0]) > 0.5 ? world[2] : world[0], world[1]],
    aInfo: [style, seed],
  })
  const colorFor = (face: number): V3 => (face === 2 ? ROOF_COLOR : color)
  const tone = (k: number): V3 => [color[0] * k, color[1] * k, color[2] * k]
  const stone: V3 = [0.5, 0.49, 0.46]
  const trimLight: V3 = [
    Math.min(1, color[0] * 0.5 + 0.45),
    Math.min(1, color[1] * 0.5 + 0.44),
    Math.min(1, color[2] * 0.5 + 0.42),
  ]

  if (b.hollow) {
    addHollow(bb, ib, b, seed)
    return
  }

  const hy = b.h / 2
  bb.box(b.x, b.y0 + hy, b.z, b.hw, hy, b.hd, b.rot, colorFor, facadeAttrs(b.style, b.y0, b.hw, b.hd), [3])
  if (b.tier) {
    const t = b.tier
    bb.box(
      b.x,
      b.y0 + b.h + t.h / 2,
      b.z,
      t.hw,
      t.h / 2,
      t.hd,
      b.rot,
      colorFor,
      facadeAttrs(b.style, b.y0, t.hw, t.hd),
      [3],
    )
  }
  const top = b.y0 + b.h + (b.tier?.h ?? 0)
  const thw = b.tier?.hw ?? b.hw
  const thd = b.tier?.hd ?? b.hd
  const isHouse = b.style === FacadeStyle.House
  const isGlass = b.style === FacadeStyle.GlassTower
  const cityBuilding = b.rot === 0

  // Plinth and cornice (classic facades)
  if (!isHouse && !isGlass && b.style !== FacadeStyle.Warehouse) {
    bb.box(b.x, b.y0 + 0.35, b.z, b.hw + 0.08, 0.35, b.hd + 0.08, b.rot, stone, plain(-2), [3])
    bb.box(b.x, b.y0 + b.h - 0.22, b.z, b.hw + 0.28, 0.22, b.hd + 0.28, b.rot, trimLight, plain(-2), [3])
    bb.box(b.x, b.y0 + b.h - 0.55, b.z, b.hw + 0.12, 0.1, b.hd + 0.12, b.rot, trimLight, plain(-2), [3])
  }
  if (isGlass) {
    // Metal crown and lobby canopy
    bb.box(b.x, top + 0.6, b.z, thw + 0.05, 0.6, thd + 0.05, b.rot, tone(0.55), plain(-6), [3])
    if (b.h + (b.tier?.h ?? 0) > 120) {
      bb.box(b.x, top + 1.2 + 9, b.z, 0.25, 9, 0.25, 0, [0.6, 0.6, 0.62], plain(-6))
      bb.box(b.x, top + 1.2 + 2, b.z, 2, 2, 2, 0, [0.4, 0.4, 0.42], plain(-2))
    }
  }

  // Parapet on every flat roof edge + rooftop equipment
  if (b.roof === 'flat') {
    const ph = isHouse ? 0.4 : 0.9
    const py = top + ph / 2
    const pc: V3 = isGlass ? tone(0.6) : trimLight
    bb.box(b.x, py, b.z - (thd - 0.12), thw, ph / 2, 0.12, b.rot, pc, plain(-2), [3])
    bb.box(b.x, py, b.z + (thd - 0.12), thw, ph / 2, 0.12, b.rot, pc, plain(-2), [3])
    bb.box(b.x - (thw - 0.12), py, b.z, 0.12, ph / 2, thd - 0.24, b.rot, pc, plain(-2), [3])
    bb.box(b.x + (thw - 0.12), py, b.z, 0.12, ph / 2, thd - 0.24, b.rot, pc, plain(-2), [3])
    if (b.h > 12) {
      const n = rng.int(2, 5)
      for (let k = 0; k < n; k++) {
        const sx = rng.range(-thw + 2.5, thw - 2.5)
        const sz = rng.range(-thd + 2.5, thd - 2.5)
        if (rng.chance(0.3)) {
          // Water tank on legs
          bb.box(b.x + sx, top + 2.6, b.z + sz, 1.3, 1.1, 1.3, 0, [0.42, 0.33, 0.25], plain(-2))
          for (const lx of [-1, 1])
            for (const lz of [-1, 1])
              bb.box(b.x + sx + lx, top + 0.75, b.z + sz + lz, 0.08, 0.75, 0.08, 0, [0.2, 0.2, 0.2], plain(-6), [3])
        } else {
          const s = rng.range(0.8, 1.8)
          bb.box(b.x + sx, top + s / 2, b.z + sz, s, s / 2, s * 0.7, 0, [0.62, 0.63, 0.64], plain(-6), [3])
        }
      }
    }
  }

  if (!cityBuilding) {
    if (b.roof === 'gable') addGableRoof(bb, b, rng, seed)
    return
  }
  const [ox, oz] = SIDE_OUT[side]
  const ax = -oz
  const az = ox
  const wallLen = side % 2 === 0 ? b.hw * 2 : b.hd * 2
  const fcx = b.x + ox * b.hw
  const fcz = b.z + oz * b.hd
  /** Box stuck on the street facade: a = offset along the wall, out = distance from the wall. */
  const wallBox = (a: number, y: number, w: number, h: number, d: number, col: V3, style: number, out = 0) => {
    const cx = fcx + ax * a + ox * (out + d / 2)
    const cz = fcz + az * a + oz * (out + d / 2)
    const even = side % 2 === 0
    bb.box(cx, y, cz, even ? w / 2 : d / 2, h / 2, even ? d / 2 : w / 2, 0, col, plain(style))
  }

  if (b.style === FacadeStyle.Shop || (b.style === FacadeStyle.Brick && rng.chance(0.5))) {
    // Striped awnings over the shop fronts.
    const ac = rng.pick(AWNINGS)
    const cell = b.style === FacadeStyle.Shop ? 3.2 : 2.6
    for (let a = -wallLen / 2 + cell / 2; a < wallLen / 2 - cell / 2 + 0.01; a += cell) {
      const w = cell - 0.35
      const yT = b.y0 + 3.05
      const p0: V3 = [fcx + ax * (a - w / 2), yT, fcz + az * (a - w / 2)]
      const p1: V3 = [fcx + ax * (a + w / 2), yT, fcz + az * (a + w / 2)]
      const p2: V3 = [p1[0] + ox * 1.3, yT - 0.5, p1[2] + oz * 1.3]
      const p3: V3 = [p0[0] + ox * 1.3, yT - 0.5, p0[2] + oz * 1.3]
      const uvs = [a - w / 2, a + w / 2, a + w / 2, a - w / 2]
      bb.quad(p0, p1, p2, p3, null, ac, (i) => ({ aUvM: [uvs[i], 0], aInfo: [-4, seed] }))
      bb.quad(p3, p2, p1, p0, null, ac, (i) => ({ aUvM: [uvs[[3, 2, 1, 0][i]], 0], aInfo: [-4, seed] }))
      const v0: V3 = [p3[0], yT - 0.5, p3[2]]
      const v1: V3 = [p2[0], yT - 0.5, p2[2]]
      bb.quad([v1[0], v1[1] - 0.25, v1[2]], [v0[0], v0[1] - 0.25, v0[2]], v0, v1, null, ac, (i) => ({
        aUvM: [uvs[[2, 3, 3, 2][i]], 0],
        aInfo: [-4, seed],
      }))
    }
  }
  if (b.style === FacadeStyle.Brick && b.h > 9) {
    // Balconies with metal railings on alternating bays.
    const floors = Math.floor(b.h / 3.1)
    for (let f = 1; f < floors; f++) {
      for (let a = -wallLen / 2 + 2.6 * 1.5; a < wallLen / 2 - 2.6; a += 5.2) {
        const y = b.y0 + f * 3.1
        wallBox(a, y, 2.2, 0.14, 1.1, stone, -2)
        // Railing: top rail + balusters
        const rail: V3 = [0.1, 0.1, 0.11]
        wallBox(a, y + 1.0, 2.2, 0.05, 0.05, rail, -6, 1.05)
        for (let k = 0; k <= 8; k++) wallBox(a - 1.05 + k * (2.1 / 8), y + 0.55, 0.025, 0.9, 0.025, rail, -6, 1.07)
      }
    }
  }
  if (b.style === FacadeStyle.Office) {
    // Entrance canopy
    wallBox(0, b.y0 + 3.4, Math.min(8, wallLen * 0.4), 0.25, 2.2, [0.2, 0.2, 0.22], -6)
  }
  if (isHouse) {
    // Align openings with the facade window grid (house window bays are 3.4 m wide):
    // the door sits in the pier between two windows, the garage covers a whole bay.
    const bay = 3.4
    const half = wallLen / 2
    const doorA = Math.round((wallLen * 0.65) / bay) * bay - half
    const garageA = (Math.floor((wallLen * 0.25) / bay) + 0.5) * bay - half
    wallBox(
      doorA,
      b.y0 + 1.1,
      1.05,
      2.2,
      0.08,
      rng.pick<V3>([
        [0.3, 0.18, 0.1],
        [0.12, 0.2, 0.32],
        [0.45, 0.1, 0.08],
        [0.15, 0.15, 0.15],
      ]),
      -5,
    )
    wallBox(doorA, b.y0 + 2.55, 1.9, 0.12, 1.2, [0.92, 0.92, 0.9], -2)
    wallBox(doorA, b.y0 + 0.08, 1.7, 0.16, 1.0, stone, -2)
    if (wallLen > 11 && Math.abs(garageA - doorA) > 2.5)
      wallBox(garageA, b.y0 + 1.2, 2.7, 2.45, 0.06, [0.86, 0.86, 0.84], -7)
    if (b.roof === 'gable') addGableRoof(bb, b, rng, seed)
  }
}

function addGableRoof(bb: GeoBuilder, b: Building, rng: Rng, seed: number) {
  const roofH = Math.min(b.hw, b.hd) * 0.7
  const y1 = b.y0 + b.h
  const yr = y1 + roofH
  const o = 0.45
  const roofCol: V3 = rng.pick<V3>([
    [0.5, 0.22, 0.15],
    [0.42, 0.2, 0.14],
    [0.26, 0.27, 0.3],
    [0.33, 0.3, 0.28],
  ])
  const color = b.color
  const gableAttrs = () => ({ aUvM: [0, 0], aInfo: [-2, seed] })
  const ridgeAlongX = b.hw >= b.hd
  if (ridgeAlongX) {
    const x0 = b.x - b.hw - o
    const x1 = b.x + b.hw + o
    const zA = b.z - b.hd - o
    const zB = b.z + b.hd + o
    const L = Math.hypot(roofH, b.hd + o)
    bb.quad([x0, y1, zB], [x1, y1, zB], [x1, yr, b.z], [x0, yr, b.z], null, roofCol, (i) => ({
      aUvM: [[x0, x1, x1, x0][i], [0, 0, L, L][i]],
      aInfo: [-3, seed],
    }))
    bb.quad([x1, y1, zA], [x0, y1, zA], [x0, yr, b.z], [x1, yr, b.z], null, roofCol, (i) => ({
      aUvM: [[x1, x0, x0, x1][i], [0, 0, L, L][i]],
      aInfo: [-3, seed],
    }))
    bb.tri([b.x + b.hw, y1, b.z + b.hd], [b.x + b.hw, y1, b.z - b.hd], [b.x + b.hw, yr, b.z], color, gableAttrs)
    bb.tri([b.x - b.hw, y1, b.z - b.hd], [b.x - b.hw, y1, b.z + b.hd], [b.x - b.hw, yr, b.z], color, gableAttrs)
    bb.box(b.x + b.hw * 0.55, yr - 0.2, b.z + b.hd * 0.3, 0.35, 0.9, 0.35, 0, [0.5, 0.28, 0.2], () => ({
      aUvM: [0, 0],
      aInfo: [-2, seed],
    }))
  } else {
    const z0 = b.z - b.hd - o
    const z1 = b.z + b.hd + o
    const xA = b.x - b.hw - o
    const xB = b.x + b.hw + o
    const L = Math.hypot(roofH, b.hw + o)
    bb.quad([xB, y1, z1], [xB, y1, z0], [b.x, yr, z0], [b.x, yr, z1], null, roofCol, (i) => ({
      aUvM: [[z1, z0, z0, z1][i], [0, 0, L, L][i]],
      aInfo: [-3, seed],
    }))
    bb.quad([xA, y1, z0], [xA, y1, z1], [b.x, yr, z1], [b.x, yr, z0], null, roofCol, (i) => ({
      aUvM: [[z0, z1, z1, z0][i], [0, 0, L, L][i]],
      aInfo: [-3, seed],
    }))
    bb.tri([b.x - b.hw, y1, b.z + b.hd], [b.x + b.hw, y1, b.z + b.hd], [b.x, yr, b.z + b.hd], color, gableAttrs)
    bb.tri([b.x + b.hw, y1, b.z - b.hd], [b.x - b.hw, y1, b.z - b.hd], [b.x, yr, b.z - b.hd], color, gableAttrs)
    bb.box(b.x + b.hw * 0.3, yr - 0.2, b.z + b.hd * 0.55, 0.35, 0.9, 0.35, 0, [0.5, 0.28, 0.2], () => ({
      aUvM: [0, 0],
      aInfo: [-2, seed],
    }))
  }
}

/** Wall boxes of a hollow building (shared with the collider builder). */
export function hollowWalls(b: Building) {
  const t = 0.3
  const door = 2.6
  const doorH = 2.8
  const walls: { x: number; y: number; z: number; hx: number; hy: number; hz: number }[] = []
  const hy = b.h / 2
  const y = b.y0 + hy
  const side = b.hollow!.doorSide
  const sides = [
    { x: b.x, z: b.z - b.hd + t / 2, hx: b.hw, hz: t / 2, alongX: true }, // 0: -z
    { x: b.x + b.hw - t / 2, z: b.z, hx: t / 2, hz: b.hd, alongX: false }, // 1: +x
    { x: b.x, z: b.z + b.hd - t / 2, hx: b.hw, hz: t / 2, alongX: true }, // 2: +z
    { x: b.x - b.hw + t / 2, z: b.z, hx: t / 2, hz: b.hd, alongX: false }, // 3: -x
  ]
  sides.forEach((s, i) => {
    if (i !== side) {
      walls.push({ x: s.x, y, z: s.z, hx: s.hx, hy, hz: s.hz })
      return
    }
    const half = s.alongX ? s.hx : s.hz
    const seg = (half * 2 - door) / 2 / 2 // half-length of each side piece
    const off = door / 2 + seg
    for (const sign of [-1, 1]) {
      walls.push({
        x: s.alongX ? s.x + sign * off : s.x,
        y,
        z: s.alongX ? s.z : s.z + sign * off,
        hx: s.alongX ? seg : s.hx,
        hy,
        hz: s.alongX ? s.hz : seg,
      })
    }
    const lintel = (b.h - doorH) / 2
    walls.push({
      x: s.x,
      y: b.y0 + doorH + lintel,
      z: s.z,
      hx: s.alongX ? door / 2 : s.hx,
      hy: lintel,
      hz: s.alongX ? s.hz : door / 2,
    })
  })
  const roof = { x: b.x, y: b.y0 + b.h + 0.15, z: b.z, hx: b.hw, hy: 0.15, hz: b.hd }
  return { walls, roof }
}

function addHollow(bb: GeoBuilder, ib: GeoBuilder, b: Building, seed: number) {
  const { walls, roof } = hollowWalls(b)
  for (const w of walls) {
    bb.box(w.x, w.y, w.z, w.hx, w.hy, w.hz, 0, b.color, (face, n, _c, world) => {
      const toCenter = (b.x - w.x) * n[0] + (b.z - w.z) * n[2]
      const interior = face !== 2 && face !== 3 && toCenter > 0
      const u = Math.abs(n[0]) > 0.5 ? world[2] - (b.z - b.hd) : world[0] - (b.x - b.hw)
      return { aUvM: [u, world[1] - b.y0], aInfo: [interior ? -2 : b.style, seed] }
    })
  }
  bb.box(roof.x, roof.y, roof.z, roof.hx, roof.hy, roof.hz, 0, ROOF_COLOR, () => ({ aUvM: [0, 0], aInfo: [-1, seed] }))

  // Interior: floor, ceiling and furniture.
  const fy = b.y0 + 0.02
  const floorCol: V3 =
    b.special === 'warehouse' ? [0.4, 0.4, 0.42] : b.special === 'gunshop' ? [0.3, 0.25, 0.2] : [0.55, 0.4, 0.28]
  ib.quad(
    [b.x - b.hw, fy, b.z + b.hd],
    [b.x + b.hw, fy, b.z + b.hd],
    [b.x + b.hw, fy, b.z - b.hd],
    [b.x - b.hw, fy, b.z - b.hd],
    [0, 1, 0],
    floorCol,
  )
  const cy = b.y0 + b.h - 0.01
  ib.quad(
    [b.x - b.hw, cy, b.z - b.hd],
    [b.x + b.hw, cy, b.z - b.hd],
    [b.x + b.hw, cy, b.z + b.hd],
    [b.x - b.hw, cy, b.z + b.hd],
    [0, -1, 0],
    [0.85, 0.85, 0.82],
  )
  const furn = (dx: number, dz: number, hx: number, hy: number, hz: number, c: V3) =>
    ib.box(b.x + dx, b.y0 + hy, b.z + dz, hx, hy, hz, 0, c)
  if (b.special === 'gunshop') {
    furn(0, 0, 3, 0.55, 0.5, [0.35, 0.22, 0.12]) // counter
    furn(0, 0, 3.05, 0.04, 0.55, [0.1, 0.1, 0.1])
    furn(-b.hw + 0.6, 0, 0.3, 1.3, b.hd - 1, [0.25, 0.25, 0.27]) // racks
    furn(b.hw - 0.6, 0, 0.3, 1.3, b.hd - 1, [0.25, 0.25, 0.27])
  } else if (b.special === 'safehouse') {
    furn(-b.hw + 1.4, -b.hd + 1.6, 1, 0.3, 1.2, [0.2, 0.3, 0.5]) // bed
    furn(b.hw - 1.2, b.hd - 1, 1, 0.45, 0.6, [0.35, 0.25, 0.18]) // table
    furn(b.hw - 0.5, -b.hd + 2, 0.4, 1, 1.2, [0.3, 0.3, 0.3]) // shelf
    furn(0, -b.hd + 0.6, 1.2, 0.45, 0.4, [0.5, 0.15, 0.12]) // sofa
  } else if (b.special === 'warehouse') {
    for (let k = 0; k < 8; k++) {
      const dx = ((k % 4) - 1.5) * 6
      const dz = (Math.floor(k / 4) - 0.5) * 8
      furn(dx, dz, 0.9, 0.9, 0.9, [0.5, 0.38, 0.2])
    }
  }
}

/** Colliders for a building (shared with physics). */
export function buildingColliderBoxes(b: Building) {
  if (b.hollow) {
    const { walls, roof } = hollowWalls(b)
    return [...walls, roof].map((w) => ({ ...w, rot: 0 }))
  }
  const boxes = [{ x: b.x, y: b.y0 + b.h / 2, z: b.z, hx: b.hw, hy: b.h / 2, hz: b.hd, rot: b.rot }]
  if (b.tier)
    boxes.push({
      x: b.x,
      y: b.y0 + b.h + b.tier.h / 2,
      z: b.z,
      hx: b.tier.hw,
      hy: b.tier.h / 2,
      hz: b.tier.hd,
      rot: b.rot,
    })
  if (b.roof === 'gable') {
    const roofH = Math.min(b.hw, b.hd) * 0.7
    boxes.push({ x: b.x, y: b.y0 + b.h + roofH / 4, z: b.z, hx: b.hw * 0.8, hy: roofH / 4, hz: b.hd * 0.8, rot: b.rot })
  }
  return boxes
}
