import { LANE_WIDTH, type RoadKind } from './constants'
import type { Polyline } from './terrain'

export interface RoadNode {
  id: number
  x: number
  z: number
  y: number
  edges: number[]
  /** Traffic light at this node (degree ≥ 3, not on hill roads). */
  light: boolean
  lightOffset: number
  /** Half-size of the intersection area (0 for bends). */
  radius: number
  /** Grid-aligned intersection (square patch) vs. free-angle (disc patch). */
  square: boolean
}

export interface RoadEdge {
  id: number
  a: number
  b: number
  kind: RoadKind
  lanes: number
  width: number
  speed: number
  length: number
}

export class RoadGraph {
  nodes: RoadNode[] = []
  edges: RoadEdge[] = []

  /** Graphe reconstruit à partir des nœuds et tronçons envoyés par le backend. */
  static from(nodes: RoadNode[], edges: RoadEdge[]): RoadGraph {
    const g = new RoadGraph()
    g.nodes = nodes
    g.edges = edges
    return g
  }

  other(edge: RoadEdge, nodeId: number): RoadNode {
    return this.nodes[edge.a === nodeId ? edge.b : edge.a]
  }

  /**
   * Point on a lane. dir=+1 travels a→b, dir=-1 travels b→a. s = distance along travel direction.
   * Right-hand traffic: lanes are offset to the right of the travel direction.
   */
  lanePoint(edge: RoadEdge, dir: 1 | -1, lane: number, s: number, target?: { x: number; y: number; z: number }) {
    const out = target ?? { x: 0, y: 0, z: 0 }
    const from = this.nodes[dir === 1 ? edge.a : edge.b]
    const to = this.nodes[dir === 1 ? edge.b : edge.a]
    const dx = (to.x - from.x) / edge.length
    const dz = (to.z - from.z) / edge.length
    const off = (lane + 0.5) * LANE_WIDTH
    const t = s / edge.length
    out.x = from.x + dx * s - dz * off
    out.z = from.z + dz * s + dx * off
    out.y = from.y + (to.y - from.y) * t
    return out
  }

  /** Unit travel direction on an edge. */
  direction(edge: RoadEdge, dir: 1 | -1) {
    const from = this.nodes[dir === 1 ? edge.a : edge.b]
    const to = this.nodes[dir === 1 ? edge.b : edge.a]
    return { x: (to.x - from.x) / edge.length, z: (to.z - from.z) / edge.length }
  }

  /** Light state for a vehicle arriving at `node` along `edge`. */
  lightState(node: RoadNode, edge: RoadEdge, time: number): 'green' | 'yellow' | 'red' {
    if (!node.light) return 'green'
    const o = this.other(edge, node.id)
    const ew = Math.abs(o.x - node.x) > Math.abs(o.z - node.z)
    const cycle = 26
    const t = (time + node.lightOffset) % cycle
    // 0-10 EW green, 10-12 EW yellow, 12-13 all red, 13-23 NS green, 23-25 NS yellow, 25-26 all red
    if (ew) return t < 10 ? 'green' : t < 12 ? 'yellow' : 'red'
    return t >= 13 && t < 23 ? 'green' : t >= 23 && t < 25 ? 'yellow' : 'red'
  }

  /** Chains of edges through degree-2 nodes, used to build continuous road ribbons. */
  chains(): { nodes: number[]; edges: number[]; kind: RoadKind; width: number; lanes: number }[] {
    const visited = new Set<number>()
    const out: ReturnType<RoadGraph['chains']> = []
    const isJoint = (n: RoadNode) => n.edges.length !== 2
    const walk = (start: RoadNode, firstEdge: RoadEdge) => {
      const nodes = [start.id]
      const edges: number[] = []
      let edge = firstEdge
      let node = start
      for (;;) {
        visited.add(edge.id)
        edges.push(edge.id)
        node = this.other(edge, node.id)
        nodes.push(node.id)
        if (isJoint(node) || node.id === start.id) break
        const next = node.edges.map((id) => this.edges[id]).find((e) => e.id !== edge.id)
        if (!next || visited.has(next.id) || next.kind !== edge.kind) break
        edge = next
      }
      out.push({ nodes, edges, kind: firstEdge.kind, width: firstEdge.width, lanes: firstEdge.lanes })
    }
    for (const n of this.nodes) {
      if (!isJoint(n)) continue
      for (const id of n.edges) if (!visited.has(id)) walk(n, this.edges[id])
    }
    // Remaining pure loops / kind changes on degree-2 nodes.
    for (const e of this.edges) if (!visited.has(e.id)) walk(this.nodes[e.a], e)
    return out
  }
}

export interface RoadNetwork {
  graph: RoadGraph
  xs: number[]
  zs: number[]
  kindX: RoadKind[]
  kindZ: RoadKind[]
  /** Hill road polylines (for terrain flattening and villa placement). */
  hillLines: Polyline[]
  /** Node ids of hill polylines, parallel to hillLines.points. */
  hillNodeIds: number[][]
  airfieldEnd: number
}
