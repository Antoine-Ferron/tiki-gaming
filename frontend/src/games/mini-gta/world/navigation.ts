import { pointSegment } from '../core/math'
import type { RoadEdge, RoadGraph, RoadNode } from './roads'

const CELL = 64

/** Spatial index + A* over the road graph (GPS, police, AI drivers). */
export class Navigation {
  private nodeCells = new Map<string, number[]>()
  private edgeCells = new Map<string, number[]>()

  constructor(readonly graph: RoadGraph) {
    for (const n of graph.nodes) this.push(this.nodeCells, n.x, n.z, n.id)
    for (const e of graph.edges) {
      const a = graph.nodes[e.a]
      const b = graph.nodes[e.b]
      const steps = Math.ceil(e.length / (CELL / 2)) + 1
      const seen = new Set<string>()
      for (let k = 0; k <= steps; k++) {
        const t = k / steps
        const key = this.key(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t)
        if (seen.has(key)) continue
        seen.add(key)
        const list = this.edgeCells.get(key) ?? []
        list.push(e.id)
        this.edgeCells.set(key, list)
      }
    }
  }

  private key(x: number, z: number) {
    return `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`
  }

  private push(map: Map<string, number[]>, x: number, z: number, id: number) {
    const k = this.key(x, z)
    const list = map.get(k) ?? []
    list.push(id)
    map.set(k, list)
  }

  private around<T>(map: Map<string, T[]>, x: number, z: number, radius: number, fn: (id: T) => void) {
    const r = Math.ceil(radius / CELL)
    const cx = Math.floor(x / CELL)
    const cz = Math.floor(z / CELL)
    for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) map.get(`${cx + i},${cz + j}`)?.forEach(fn)
  }

  nearestNode(x: number, z: number, maxRadius = 600): RoadNode | undefined {
    for (let radius = CELL; radius <= maxRadius; radius *= 2) {
      let best: RoadNode | undefined
      let bestD = Infinity
      this.around(this.nodeCells, x, z, radius, (id) => {
        const n = this.graph.nodes[id]
        const d = Math.hypot(n.x - x, n.z - z)
        if (d < bestD) {
          bestD = d
          best = n
        }
      })
      if (best) return best
    }
    return undefined
  }

  /** Closest point on the road network. */
  nearestEdge(x: number, z: number, maxRadius = 300): { edge: RoadEdge; t: number; d: number } | undefined {
    let best: { edge: RoadEdge; t: number; d: number } | undefined
    for (let radius = CELL; radius <= maxRadius && !best; radius *= 2) {
      this.around(this.edgeCells, x, z, radius, (id) => {
        const e = this.graph.edges[id]
        const a = this.graph.nodes[e.a]
        const b = this.graph.nodes[e.b]
        const r = pointSegment(x, z, a.x, a.z, b.x, b.z)
        if (!best || r.d < best.d) best = { edge: e, t: r.t, d: r.d }
      })
    }
    return best
  }

  /** Edges having at least one point within [minR, maxR] of (x,z). */
  edgesInRing(x: number, z: number, minR: number, maxR: number): RoadEdge[] {
    const out = new Set<number>()
    this.around(this.edgeCells, x, z, maxR, (id) => out.add(id))
    return [...out]
      .map((id) => this.graph.edges[id])
      .filter((e) => {
        const a = this.graph.nodes[e.a]
        const b = this.graph.nodes[e.b]
        const d = pointSegment(x, z, a.x, a.z, b.x, b.z).d
        const far = Math.max(Math.hypot(a.x - x, a.z - z), Math.hypot(b.x - x, b.z - z))
        return d <= maxR && far >= minR
      })
  }

  /** A* returning node ids from `from` to `to` (inclusive), or [] if unreachable. */
  findPath(from: number, to: number): number[] {
    const g = this.graph
    const goal = g.nodes[to]
    const h = (id: number) => Math.hypot(g.nodes[id].x - goal.x, g.nodes[id].z - goal.z) / 24
    const open = new MinHeap()
    const gScore = new Map<number, number>([[from, 0]])
    const came = new Map<number, number>()
    open.push(from, h(from))
    const closed = new Set<number>()
    while (open.size) {
      const cur = open.pop()
      if (cur === to) {
        const path = [cur]
        let c = cur
        while (came.has(c)) {
          c = came.get(c)!
          path.push(c)
        }
        return path.reverse()
      }
      if (closed.has(cur)) continue
      closed.add(cur)
      for (const eid of g.nodes[cur].edges) {
        const e = g.edges[eid]
        const nb = e.a === cur ? e.b : e.a
        const cost = gScore.get(cur)! + e.length / e.speed
        if (cost < (gScore.get(nb) ?? Infinity)) {
          gScore.set(nb, cost)
          came.set(nb, cur)
          open.push(nb, cost + h(nb))
        }
      }
    }
    return []
  }

  edgeBetween(a: number, b: number): RoadEdge | undefined {
    for (const id of this.graph.nodes[a].edges) {
      const e = this.graph.edges[id]
      if ((e.a === a && e.b === b) || (e.a === b && e.b === a)) return e
    }
    return undefined
  }
}

class MinHeap {
  private ids: number[] = []
  private keys: number[] = []
  get size() {
    return this.ids.length
  }
  push(id: number, key: number) {
    this.ids.push(id)
    this.keys.push(key)
    let i = this.ids.length - 1
    while (i > 0) {
      const p = (i - 1) >> 1
      if (this.keys[p] <= this.keys[i]) break
      this.swap(i, p)
      i = p
    }
  }
  pop(): number {
    const top = this.ids[0]
    const lastId = this.ids.pop()!
    const lastKey = this.keys.pop()!
    if (this.ids.length) {
      this.ids[0] = lastId
      this.keys[0] = lastKey
      let i = 0
      for (;;) {
        const l = i * 2 + 1
        const r = l + 1
        let m = i
        if (l < this.ids.length && this.keys[l] < this.keys[m]) m = l
        if (r < this.ids.length && this.keys[r] < this.keys[m]) m = r
        if (m === i) break
        this.swap(i, m)
        i = m
      }
    }
    return top
  }
  private swap(a: number, b: number) {
    ;[this.ids[a], this.ids[b]] = [this.ids[b], this.ids[a]]
    ;[this.keys[a], this.keys[b]] = [this.keys[b], this.keys[a]]
  }
}
