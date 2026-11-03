import { Euler, Quaternion, Vector3 } from 'three'
import { clamp } from '../core/math'
import { Rng } from '../core/rng'
import { VEHICLES, TRAFFIC_POOL } from '../procgen/vehicles/specs'
import type { RoadEdge, RoadNode } from '../world/roads'
import type { Vehicle } from '../entities/Vehicle'
import type { Game } from '../game/Game'
import { DriverAI } from './DriverAI'

interface Turn {
  p0: Vector3
  p1: Vector3
  m0: Vector3
  m1: Vector3
  len: number
  t: number
  edge: RoadEdge
  dir: 1 | -1
  lane: number
}

export interface TrafficState {
  edge: RoadEdge
  dir: 1 | -1
  lane: number
  s: number
  speed: number
  cruise: number
  turn: Turn | null
  stuck: number
}

export const TRAFFIC_SETTINGS = { density: 22, parked: 14 }

const _p = { x: 0, y: 0, z: 0 }
const _a = new Vector3()
const _b = new Vector3()
const _q = new Quaternion()
const _e = new Euler(0, 0, 0, 'YXZ')

function hermite(t: Turn, u: number, out: Vector3) {
  const u2 = u * u
  const u3 = u2 * u
  const h00 = 2 * u3 - 3 * u2 + 1
  const h10 = u3 - 2 * u2 + u
  const h01 = -2 * u3 + 3 * u2
  const h11 = u3 - u2
  return out
    .copy(t.p0)
    .multiplyScalar(h00)
    .addScaledVector(t.m0, h10)
    .addScaledVector(t.p1, h01)
    .addScaledVector(t.m1, h11)
}

/** Ambient traffic: kinematic lane-followers, parked cars, spawn/despawn around the player. */
export class Traffic {
  readonly cars = new Set<Vehicle>()
  readonly parked = new Set<Vehicle>()
  private rng = new Rng(4242)
  private spawnTimer = 0
  private obstacles: { x: number; z: number; r: number; v: Vehicle | null }[] = []

  constructor(private game: Game) {}

  private endNode(st: { edge: RoadEdge; dir: 1 | -1 }): RoadNode {
    const g = this.game.city.roads.graph
    return g.nodes[st.dir === 1 ? st.edge.b : st.edge.a]
  }

  private trim(n: RoadNode) {
    return n.radius > 0 ? n.radius + 1 : 3
  }

  private pickSpec() {
    const total = TRAFFIC_POOL.reduce((a, [, w]) => a + w, 0)
    let r = this.rng.next() * total
    for (const [id, w] of TRAFFIC_POOL) {
      r -= w
      if (r <= 0) return id
    }
    return 'sedan'
  }

  private visible(x: number, z: number, margin = 0.35) {
    const cam = this.game.camera
    _a.set(x - cam.position.x, 0, z - cam.position.z)
    const d = _a.length()
    if (d < 25) return true
    cam.getWorldDirection(_b)
    _b.y = 0
    _b.normalize()
    return _a.dot(_b) / d > margin && d < 200
  }

  update(dt: number) {
    const game = this.game
    const player = game.player.position
    this.spawnTimer -= dt
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 0.25
      this.manage(player)
    }
    // Obstacles: every vehicle, the player and pedestrians on the road.
    this.obstacles.length = 0
    for (const v of game.vehicles) this.obstacles.push({ x: v.position.x, z: v.position.z, r: v.spec.width / 2, v })
    if (game.player.state === 'foot') this.obstacles.push({ x: player.x, z: player.z, r: 0.5, v: null })
    for (const a of game.peds.actors())
      if (!a.dead && !a.seatedIn) this.obstacles.push({ x: a.position.x, z: a.position.z, r: 0.4, v: null })
    for (const a of game.police.actors())
      if (!a.dead && !a.seatedIn) this.obstacles.push({ x: a.position.x, z: a.position.z, r: 0.4, v: null })

    for (const v of this.cars) {
      const st = v.traffic as TrafficState | null
      if (!st || v.mode !== 'kinematic') continue
      this.drive(v, st, dt)
    }
  }

  private drive(v: Vehicle, st: TrafficState, dt: number): void {
    const g = this.game.city.roads.graph
    const end = this.endNode(st)
    const stopAt = st.edge.length - this.trim(end)
    // Gap to the closest obstacle ahead.
    const h = v.heading()
    const fx = Math.sin(h)
    const fz = Math.cos(h)
    const px = v.position.x
    const pz = v.position.z
    const half = v.spec.length / 2
    let gap = Infinity
    const look = 8 + st.speed * 2
    for (const o of this.obstacles) {
      if (o.v === v) continue
      const dx = o.x - px
      const dz = o.z - pz
      const along = dx * fx + dz * fz
      if (along <= 0 || along > look + half + 6) continue
      const lat = Math.abs(dx * -fz + dz * fx)
      if (lat > v.spec.width / 2 + o.r + 0.5) continue
      const extra = o.v ? o.v.spec.length / 2 : o.r
      gap = Math.min(gap, along - half - extra)
    }
    let desired = st.cruise * st.edge.speed
    if (st.turn) desired = Math.min(desired, 8)
    else {
      const remaining = stopAt - st.s
      if (end.light && remaining > -0.5) {
        const light = g.lightState(end, st.edge, this.game.time)
        if (light === 'red' || (light === 'yellow' && remaining > st.speed * 1.2)) {
          desired = Math.min(desired, Math.max(0, (remaining - 1) * 0.9))
          if (remaining < 1.5) desired = 0
        }
      }
      // Slow before turning.
      if (remaining < 25) desired = Math.min(desired, 8 + remaining * 0.4)
    }
    if (gap < Infinity) desired = Math.min(desired, Math.max(0, (gap - 2.5) * 1.1))
    const accel = desired > st.speed ? 3 : 9
    st.speed = clamp(st.speed + clamp(desired - st.speed, -accel * dt, accel * dt), 0, 40)
    st.stuck = st.speed < 0.3 ? st.stuck + dt : 0

    let steer = 0
    let x: number
    let y: number
    let z: number
    let heading: number
    let grade = 0
    if (st.turn) {
      const t = st.turn
      t.t += (st.speed * dt) / t.len
      if (t.t >= 1) {
        st.edge = t.edge
        st.dir = t.dir
        st.lane = t.lane
        st.s = this.trim(g.nodes[t.dir === 1 ? t.edge.a : t.edge.b])
        st.turn = null
        return this.drive(v, st, 0)
      }
      hermite(t, t.t, _a)
      hermite(t, Math.min(1, t.t + 0.05), _b)
      x = _a.x
      y = _a.y
      z = _a.z
      heading = Math.atan2(_b.x - _a.x, _b.z - _a.z)
      steer = clamp(((heading - h + Math.PI * 3) % (Math.PI * 2)) - Math.PI, -1, 1) * -3
    } else {
      st.s += st.speed * dt
      if (st.s >= stopAt) this.startTurn(st, end)
      const s = Math.min(st.s, st.edge.length)
      g.lanePoint(st.edge, st.dir, st.lane, s, _p)
      x = _p.x
      y = _p.y
      z = _p.z
      const d = g.direction(st.edge, st.dir)
      heading = Math.atan2(d.x, d.z)
      const from = g.nodes[st.dir === 1 ? st.edge.a : st.edge.b]
      grade = (end.y - from.y) / st.edge.length
    }
    v.setPose(x, y, z, heading, st.speed, clamp(steer, -1, 1))
    if (grade !== 0) {
      _e.set(-Math.atan(grade), heading, 0)
      _q.setFromEuler(_e)
      v.body.setNextKinematicRotation(_q)
    }
  }

  private startTurn(st: TrafficState, node: RoadNode) {
    const g = this.game.city.roads.graph
    const options = node.edges.map((id) => g.edges[id]).filter((e) => e.id !== st.edge.id)
    let next = options.length ? options[Math.floor(this.rng.next() * options.length)] : st.edge
    // Prefer staying on similar roads; avoid dead ends unless no choice.
    if (options.length > 1) {
      const nonDead = options.filter((e) => g.other(e, node.id).edges.length > 1)
      if (nonDead.length) next = nonDead[Math.floor(this.rng.next() * nonDead.length)]
    }
    const dir: 1 | -1 = next.a === node.id ? 1 : -1
    const lane = Math.min(st.lane, next.lanes - 1)
    const p0 = new Vector3()
    g.lanePoint(st.edge, st.dir, st.lane, Math.min(st.s, st.edge.length), _p)
    p0.set(_p.x, _p.y, _p.z)
    const startS = this.trim(node)
    g.lanePoint(next, dir, lane, startS, _p)
    const p1 = new Vector3(_p.x, _p.y, _p.z)
    const d0 = g.direction(st.edge, st.dir)
    const d1 = g.direction(next, dir)
    const L = Math.max(2, p0.distanceTo(p1))
    st.turn = {
      p0,
      p1,
      m0: new Vector3(d0.x * L, 0, d0.z * L),
      m1: new Vector3(d1.x * L, 0, d1.z * L),
      len: L * 1.15,
      t: 0,
      edge: next,
      dir,
      lane,
    }
  }

  /** Spawn and despawn around the player. */
  private manage(player: Vector3) {
    const game = this.game
    for (const v of [...this.cars, ...this.parked]) {
      if (v === game.player.vehicle || v.persistent || v.tags.size) continue
      const d = Math.hypot(v.position.x - player.x, v.position.z - player.z)
      const st = v.traffic as TrafficState | null
      const stuck = st && st.stuck > 25
      if (
        d > 420 ||
        (d > 230 && !this.visible(v.position.x, v.position.z)) ||
        (stuck && !this.visible(v.position.x, v.position.z, 0.1))
      ) {
        this.cars.delete(v)
        this.parked.delete(v)
        game.removeVehicle(v)
      }
    }
    if (this.cars.size < TRAFFIC_SETTINGS.density) this.spawnMoving(player)
    if (this.parked.size < TRAFFIC_SETTINGS.parked) this.spawnParked(player)
  }

  private spawnMoving(player: Vector3) {
    const game = this.game
    const edges = game.nav.edgesInRing(player.x, player.z, 90, 220)
    if (!edges.length) return
    const e = edges[Math.floor(this.rng.next() * edges.length)]
    const dir: 1 | -1 = this.rng.chance(0.5) ? 1 : -1
    const lane = Math.floor(this.rng.next() * e.lanes)
    const g = game.city.roads.graph
    const s = this.rng.range(8, Math.max(9, e.length - 12))
    g.lanePoint(e, dir, lane, s, _p)
    const d = Math.hypot(_p.x - player.x, _p.z - player.z)
    if (d < 80 || this.visible(_p.x, _p.z)) return
    for (const v of game.vehicles) if (Math.hypot(v.position.x - _p.x, v.position.z - _p.z) < 14) return
    let specId = this.pickSpec()
    if (e.kind === 'hill' && (specId === 'bus' || specId === 'truck')) specId = 'sedan'
    const dv = g.direction(e, dir)
    const v = game.spawnVehicle(specId, _p.x, _p.y, _p.z, Math.atan2(dv.x, dv.z), 'kinematic')
    v.driver = game.peds.createSeated(v)
    const st: TrafficState = {
      edge: e,
      dir,
      lane,
      s,
      speed: e.speed * 0.6,
      cruise: this.rng.range(0.8, 1.05) * (VEHICLES[specId].maxSpeed < 30 ? 0.85 : 1),
      turn: null,
      stuck: 0,
    }
    v.traffic = st
    this.cars.add(v)
  }

  private spawnParked(player: Vector3) {
    const game = this.game
    const spots = game.city.parking
    for (let k = 0; k < 8; k++) {
      const s = spots[Math.floor(this.rng.next() * spots.length)]
      const d = Math.hypot(s.x - player.x, s.z - player.z)
      if (d < 60 || d > 190 || this.visible(s.x, s.z)) continue
      let free = true
      for (const v of game.vehicles) if (Math.hypot(v.position.x - s.x, v.position.z - s.z) < 7) free = false
      if (!free) continue
      const pool = ['sedan', 'sedan', 'suv', 'sport', 'van', 'bike', 'taxi']
      const v = game.spawnVehicle(
        pool[Math.floor(this.rng.next() * pool.length)],
        s.x,
        s.y + 0.15,
        s.z,
        s.heading,
        'dynamic',
      )
      v.body.sleep()
      this.parked.add(v)
      return
    }
  }

  /** A kinematic car was hit by a dynamic body: it becomes physical and its driver reacts. */
  onBumped(v: Vehicle, by: Vehicle) {
    if (v.mode !== 'kinematic') return
    v.makeDynamic()
    const dx = v.position.x - by.position.x
    const dz = v.position.z - by.position.z
    const len = Math.hypot(dx, dz) || 1
    const imp = by.spec.mass * Math.min(10, Math.abs(by.speed)) * 0.25
    v.body.applyImpulse({ x: (dx / len) * imp, y: 0, z: (dz / len) * imp }, true)
    if (v.driver) {
      // After the shock the driver drives away (dynamic AI) or flees on foot.
      const ai = new DriverAI(this.game, 'cruise')
      ai.maxSpeed = 14
      v.driverAI = ai
    }
  }

  /** Detach a vehicle from the traffic system (stolen, mission...). */
  release(v: Vehicle) {
    v.traffic = null
    this.cars.delete(v)
    this.parked.delete(v)
  }

  dispose() {
    this.cars.clear()
    this.parked.clear()
  }
}
