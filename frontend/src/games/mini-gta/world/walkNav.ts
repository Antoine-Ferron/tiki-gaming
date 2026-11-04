import { Vector3 } from 'three'
import type { SidewalkNode } from './city'

/** Pedestrian navigation on the sidewalk graph (block corners + crosswalks). */
export class WalkNav {
  constructor(private nodes: SidewalkNode[]) {}

  /** The `k` nodes closest to a point, nearest first. */
  nearest(x: number, z: number, k: number): SidewalkNode[] {
    return [...this.nodes].sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z)).slice(0, k)
  }

  /**
   * Walking path from `from` to `to`. Entry and exit nodes must be visible (`visible`) from the
   * endpoints so the straight legs do not cut through buildings.
   */
  path(
    from: Vector3,
    to: Vector3,
    visible: (a: { x: number; z: number }, b: { x: number; z: number }) => boolean,
  ): Vector3[] {
    if (visible(from, to)) return [to.clone()]
    const start = this.nearest(from.x, from.z, 6).find((n) => visible(from, n)) ?? this.nearest(from.x, from.z, 1)[0]
    const goal = this.nearest(to.x, to.z, 6).find((n) => visible(n, to)) ?? this.nearest(to.x, to.z, 1)[0]
    if (!start || !goal) return [to.clone()]
    const ids = this.astar(start.id, goal.id)
    const pts = ids.map((id) => new Vector3(this.nodes[id].x, 0, this.nodes[id].z))
    pts.push(to.clone())
    return pts
  }

  private astar(from: number, to: number): number[] {
    const N = this.nodes
    const goal = N[to]
    const g = new Map<number, number>([[from, 0]])
    const came = new Map<number, number>()
    const open = new Set([from])
    const f = new Map<number, number>([[from, Math.hypot(N[from].x - goal.x, N[from].z - goal.z)]])
    while (open.size) {
      let cur = -1
      let best = Infinity
      for (const id of open) {
        const v = f.get(id) ?? Infinity
        if (v < best) {
          best = v
          cur = id
        }
      }
      if (cur === to) {
        const out = [cur]
        while (came.has(cur)) {
          cur = came.get(cur)!
          out.push(cur)
        }
        return out.reverse()
      }
      open.delete(cur)
      for (const nb of N[cur].links) {
        const cost = g.get(cur)! + Math.hypot(N[nb].x - N[cur].x, N[nb].z - N[cur].z)
        if (cost < (g.get(nb) ?? Infinity)) {
          came.set(nb, cur)
          g.set(nb, cost)
          f.set(nb, cost + Math.hypot(N[nb].x - goal.x, N[nb].z - goal.z))
          open.add(nb)
        }
      }
    }
    return [from]
  }
}
