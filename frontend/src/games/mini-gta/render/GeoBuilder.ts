import { BufferGeometry, Float32BufferAttribute, Uint32BufferAttribute } from 'three'

export type V3 = [number, number, number]

/** Incremental geometry builder with arbitrary float attributes (position, normal, color + custom). */
export class GeoBuilder {
  pos: number[] = []
  nor: number[] = []
  col: number[] = []
  idx: number[] = []
  extra: Record<string, { size: number; data: number[] }> = {}

  constructor(extraAttrs: Record<string, number> = {}) {
    for (const [name, size] of Object.entries(extraAttrs)) this.extra[name] = { size, data: [] }
  }

  get vertexCount() {
    return this.pos.length / 3
  }

  vertex(p: V3, n: V3, c: V3, attrs: Record<string, number[]> = {}) {
    this.pos.push(p[0], p[1], p[2])
    this.nor.push(n[0], n[1], n[2])
    this.col.push(c[0], c[1], c[2])
    for (const [name, a] of Object.entries(this.extra)) {
      const v = attrs[name]
      for (let i = 0; i < a.size; i++) a.data.push(v ? v[i] : 0)
    }
    return this.vertexCount - 1
  }

  /** Quad p0..p3 counter-clockwise when seen from the normal side. attrs: per-vertex arrays or shared. */
  quad(
    p0: V3,
    p1: V3,
    p2: V3,
    p3: V3,
    n: V3 | null,
    c: V3,
    attrs: (i: number) => Record<string, number[]> = () => ({}),
  ) {
    const normal = n ?? faceNormal(p0, p1, p2)
    const base = this.vertexCount
    ;[p0, p1, p2, p3].forEach((p, i) => this.vertex(p, normal, c, attrs(i)))
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3)
  }

  tri(p0: V3, p1: V3, p2: V3, c: V3, attrs: (i: number) => Record<string, number[]> = () => ({})) {
    const n = faceNormal(p0, p1, p2)
    const base = this.vertexCount
    ;[p0, p1, p2].forEach((p, i) => this.vertex(p, n, c, attrs(i)))
    this.idx.push(base, base + 1, base + 2)
  }

  /**
   * Oriented box. center/half extents in local space, rotated by `rot` around Y then translated.
   * faceAttrs(faceIndex, normal, cornerIndex, localCorner) lets callers compute UVs per face.
   * Faces: 0 +x, 1 -x, 2 +y, 3 -y, 4 +z, 5 -z.
   */
  box(
    cx: number,
    cy: number,
    cz: number,
    hx: number,
    hy: number,
    hz: number,
    rot: number,
    color: V3 | ((face: number) => V3),
    faceAttrs?: (face: number, n: V3, corner: number, world: V3, local: V3) => Record<string, number[]>,
    skipFaces: number[] = [],
  ) {
    const c = Math.cos(rot)
    const s = Math.sin(rot)
    const tf = (x: number, y: number, z: number): V3 => [cx + x * c + z * s, cy + y, cz - x * s + z * c]
    const tn = (x: number, y: number, z: number): V3 => [x * c + z * s, y, -x * s + z * c]
    const faces: [V3, V3[]][] = [
      [
        [1, 0, 0],
        [
          [hx, -hy, hz],
          [hx, -hy, -hz],
          [hx, hy, -hz],
          [hx, hy, hz],
        ],
      ],
      [
        [-1, 0, 0],
        [
          [-hx, -hy, -hz],
          [-hx, -hy, hz],
          [-hx, hy, hz],
          [-hx, hy, -hz],
        ],
      ],
      [
        [0, 1, 0],
        [
          [-hx, hy, hz],
          [hx, hy, hz],
          [hx, hy, -hz],
          [-hx, hy, -hz],
        ],
      ],
      [
        [0, -1, 0],
        [
          [-hx, -hy, -hz],
          [hx, -hy, -hz],
          [hx, -hy, hz],
          [-hx, -hy, hz],
        ],
      ],
      [
        [0, 0, 1],
        [
          [-hx, -hy, hz],
          [hx, -hy, hz],
          [hx, hy, hz],
          [-hx, hy, hz],
        ],
      ],
      [
        [0, 0, -1],
        [
          [hx, -hy, -hz],
          [-hx, -hy, -hz],
          [-hx, hy, -hz],
          [hx, hy, -hz],
        ],
      ],
    ]
    faces.forEach(([n, corners], f) => {
      if (skipFaces.includes(f)) return
      const wn = tn(...n)
      const wc = corners.map((p) => tf(...p))
      const col = typeof color === 'function' ? color(f) : color
      this.quad(wc[0], wc[1], wc[2], wc[3], wn, col, (i) => (faceAttrs ? faceAttrs(f, wn, i, wc[i], corners[i]) : {}))
    })
  }

  /** Append another builder's content (same attribute layout). */
  merge(other: GeoBuilder) {
    const base = this.vertexCount
    this.pos.push(...other.pos)
    this.nor.push(...other.nor)
    this.col.push(...other.col)
    for (const [k, a] of Object.entries(this.extra)) a.data.push(...(other.extra[k]?.data ?? []))
    for (const i of other.idx) this.idx.push(base + i)
  }

  build(): BufferGeometry | null {
    if (this.pos.length === 0) return null
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(this.pos, 3))
    g.setAttribute('normal', new Float32BufferAttribute(this.nor, 3))
    g.setAttribute('color', new Float32BufferAttribute(this.col, 3))
    for (const [name, a] of Object.entries(this.extra)) g.setAttribute(name, new Float32BufferAttribute(a.data, a.size))
    g.setIndex(new Uint32BufferAttribute(this.idx, 1))
    g.computeBoundingSphere()
    g.computeBoundingBox()
    return g
  }
}

export function faceNormal(a: V3, b: V3, c: V3): V3 {
  const ux = b[0] - a[0]
  const uy = b[1] - a[1]
  const uz = b[2] - a[2]
  const vx = c[0] - a[0]
  const vy = c[1] - a[1]
  const vz = c[2] - a[2]
  const nx = uy * vz - uz * vy
  const ny = uz * vx - ux * vz
  const nz = ux * vy - uy * vx
  const l = Math.hypot(nx, ny, nz) || 1
  return [nx / l, ny / l, nz / l]
}
