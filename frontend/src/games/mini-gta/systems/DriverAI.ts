import { Vector3 } from 'three'
import { clamp } from '../core/math'
import { Groups } from '../physics/physics'
import { LANE_WIDTH } from '../world/constants'
import type { Vehicle } from '../entities/Vehicle'
import type { Game } from '../game/Game'

export type DriveMode = 'cruise' | 'chase' | 'flee' | 'goto' | 'park'

const _d = new Vector3()
const _f = new Vector3()

/** Steers a dynamic vehicle along road-graph paths (police, fleeing targets, recovered traffic). */
export class DriverAI {
  path: Vector3[] = []
  private repath = 0
  private stuck = 0
  private reverse = 0
  maxSpeed = 18
  aggressive = false
  /** Distance under which the driver goes straight for the target. */
  directRange = 35

  constructor(
    private game: Game,
    public mode: DriveMode,
    public target?: () => Vector3,
  ) {}

  private computePath(v: Vehicle) {
    const nav = this.game.nav
    const from = nav.nearestNode(v.position.x, v.position.z)
    if (!from) return
    let goal: number | undefined
    if (this.mode === 'flee' || this.mode === 'cruise') {
      // Pick a node far away (away from the threat when fleeing).
      const threat = this.target?.()
      const g = this.game.city.roads.graph
      let best = -Infinity
      for (let k = 0; k < 24; k++) {
        const n = g.nodes[Math.floor(Math.random() * g.nodes.length)]
        const d = Math.hypot(n.x - v.position.x, n.z - v.position.z)
        if (d < 150 || d > 700) continue
        const score =
          threat && this.mode === 'flee' ? Math.hypot(n.x - threat.x, n.z - threat.z) - d * 0.3 : Math.random()
        if (score > best) {
          best = score
          goal = n.id
        }
      }
    } else if (this.target) {
      const t = this.target()
      goal = nav.nearestNode(t.x, t.z)?.id
    }
    if (goal === undefined) return
    const ids = nav.findPath(from.id, goal)
    const g = this.game.city.roads.graph
    // Offset each waypoint to the right-hand lane.
    this.path = ids.map((id, i) => {
      const n = g.nodes[id]
      const next = g.nodes[ids[i + 1] ?? id]
      const prev = g.nodes[ids[i - 1] ?? id]
      let dx = next.x - prev.x
      let dz = next.z - prev.z
      const len = Math.hypot(dx, dz) || 1
      dx /= len
      dz /= len
      const off = LANE_WIDTH * 0.5
      return new Vector3(n.x - dz * off, n.y, n.z + dx * off)
    })
    // Already between the first two nodes: don't drive back to the first one.
    const p = v.position
    while (this.path.length >= 2) {
      const a = this.path[0]
      const b = this.path[1]
      if (Math.hypot(b.x - p.x, b.z - p.z) < Math.hypot(b.x - a.x, b.z - a.z)) this.path.shift()
      else break
    }
  }

  update(v: Vehicle, dt: number) {
    if (v.destroyed || !v.driver || v.playerDriven) {
      v.control.throttle = 0
      return
    }
    this.repath -= dt
    const pos = v.position
    const target = this.target?.()
    const direct =
      target && (this.mode === 'chase' || this.mode === 'goto') && pos.distanceTo(target) < this.directRange
    if (!direct && (this.repath <= 0 || this.path.length === 0)) {
      this.repath = this.mode === 'chase' ? 2.5 : 8
      this.computePath(v)
    }
    while (this.path.length && Math.hypot(this.path[0].x - pos.x, this.path[0].z - pos.z) < 9) this.path.shift()
    const aim = direct ? target! : this.path[0]
    const c = v.control
    if (!aim) {
      c.throttle = -0.3
      c.steer = 0
      return
    }
    v.forward(_f)
    _d.copy(aim).sub(pos).setY(0)
    const dist = _d.length()
    _d.divideScalar(dist || 1)
    const h = Math.atan2(_f.x, _f.z)
    const rightX = -Math.cos(h)
    const rightZ = Math.sin(h)
    const lateral = _d.x * rightX + _d.z * rightZ
    const ahead = _d.x * _f.x + _d.z * _f.z
    const angle = Math.atan2(lateral, ahead)

    if (this.mode === 'park' || (this.mode === 'goto' && target && dist < 6)) {
      c.throttle = v.speed > 0.5 ? -1 : 0
      c.steer = 0
      c.handbrake = true
      return
    }
    c.handbrake = false
    // Obstacle probe ahead (buildings, walls).
    const p = v.body.translation()
    const probe = this.game.physics.raycast(p.x, p.y + 0.8, p.z, _f.x, 0, _f.z, 10 + Math.abs(v.speed), Groups.rayWorld)
    let desired = this.maxSpeed * (1 - Math.min(1, Math.abs(angle) / 1.6) * 0.75)
    if (probe) desired = Math.min(desired, probe.distance * 0.8)
    if (direct && this.mode === 'chase' && !this.aggressive) desired = Math.min(desired, dist * 0.6)

    if (this.reverse > 0) {
      this.reverse -= dt
      c.throttle = -1
      c.steer = -Math.sign(angle)
      return
    }
    c.steer = clamp(angle * 1.8, -1, 1)
    c.throttle = v.speed < desired ? 1 : v.speed > desired + 3 ? -0.6 : 0.15
    if (Math.abs(v.speed) < 1 && c.throttle > 0) this.stuck += dt
    else this.stuck = Math.max(0, this.stuck - dt)
    if (this.stuck > 1.6) {
      this.stuck = 0
      this.reverse = 1.4
    }
  }
}
