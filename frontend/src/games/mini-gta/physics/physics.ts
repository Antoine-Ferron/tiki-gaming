import { FIXED_DT } from '../core/config'
import { EventQueue, World, type Collider, type RigidBody } from './engine'

export * from './engine'

/** Collision layers (bit index). */
export const Layer = {
  Static: 1,
  Player: 1 << 1,
  Vehicle: 1 << 2,
  Npc: 1 << 3,
  Debris: 1 << 4,
  Projectile: 1 << 5,
  Prop: 1 << 6,
  Sensor: 1 << 7,
  /** Dalles des trottoirs : les roues montent dessus, la caisse des véhicules les ignore. */
  Curb: 1 << 8,
} as const

const ALL = 0xffff

/** Rapier interaction groups: high 16 bits = membership, low 16 bits = filter. */
export function groups(membership: number, filter: number = ALL): number {
  return ((membership & 0xffff) << 16) | (filter & 0xffff)
}

export const Groups = {
  static: groups(Layer.Static),
  curb: groups(Layer.Curb, ALL & ~Layer.Vehicle),
  prop: groups(Layer.Prop),
  player: groups(Layer.Player, ALL & ~Layer.Sensor),
  vehicle: groups(Layer.Vehicle),
  npc: groups(Layer.Npc, ALL & ~Layer.Npc & ~Layer.Sensor),
  /** Débris de props : ils ne bloquent pas les véhicules (un lampadaire renversé naît dans la voiture qui l'a percuté). */
  debris: groups(Layer.Debris, ALL & ~Layer.Vehicle),
  projectile: groups(Layer.Projectile, Layer.Static | Layer.Curb | Layer.Vehicle | Layer.Prop | Layer.Debris),
  /** Ray filters */
  rayWorld: groups(ALL, Layer.Static | Layer.Curb | Layer.Prop),
  rayCamera: groups(ALL, Layer.Static),
  rayAll: groups(ALL, ALL & ~Layer.Sensor),
  /** Wheels only touch the ground and static stuff, not NPC capsules. */
  wheels: groups(ALL, Layer.Static | Layer.Curb | Layer.Prop | Layer.Vehicle | Layer.Debris),
}

/** Something a collider belongs to, for hit resolution. */
export type Owner =
  | { kind: 'static' }
  | { kind: 'prop'; id: number }
  | { kind: 'vehicle'; ref: unknown }
  | { kind: 'character'; ref: unknown }
  | { kind: 'debris'; ref: unknown }

export class Physics {
  readonly world: World
  readonly events: EventQueue
  private owners = new Map<number, Owner>()

  constructor() {
    this.world = new World({ x: 0, y: -9.81, z: 0 })
    this.world.timestep = FIXED_DT
    this.events = new EventQueue(true)
  }

  setOwner(collider: Collider, owner: Owner) {
    this.owners.set(collider.handle, owner)
  }

  ownerOf(collider: Collider | null | undefined): Owner | undefined {
    return collider ? this.owners.get(collider.handle) : undefined
  }

  removeBody(body: RigidBody) {
    for (let i = 0; i < body.numColliders(); i++) this.owners.delete(body.collider(i).handle)
    this.world.removeRigidBody(body)
  }

  removeCollider(collider: Collider) {
    this.owners.delete(collider.handle)
    this.world.removeCollider(collider, true)
  }

  step() {
    this.world.step(this.events)
  }

  /** Ray cast; returns hit point, normal, distance and collider. */
  raycast(
    ox: number,
    oy: number,
    oz: number,
    dx: number,
    dy: number,
    dz: number,
    maxDist: number,
    filterGroups: number = Groups.rayAll,
    excludeBody?: RigidBody,
    predicate?: (c: Collider) => boolean,
  ) {
    const hit = this.world.castRayAndGetNormal(
      { origin: { x: ox, y: oy, z: oz }, dir: { x: dx, y: dy, z: dz } },
      maxDist,
      true,
      undefined,
      filterGroups,
      undefined,
      excludeBody,
      predicate,
    )
    if (!hit) return null
    const t = hit.timeOfImpact
    return {
      x: ox + dx * t,
      y: oy + dy * t,
      z: oz + dz * t,
      nx: hit.normal.x,
      ny: hit.normal.y,
      nz: hit.normal.z,
      distance: t,
      collider: hit.collider,
    }
  }

  /** Line-of-sight test against static geometry only. */
  lineOfSight(ax: number, ay: number, az: number, bx: number, by: number, bz: number): boolean {
    const dx = bx - ax
    const dy = by - ay
    const dz = bz - az
    const len = Math.hypot(dx, dy, dz)
    if (len < 0.01) return true
    return !this.raycast(ax, ay, az, dx / len, dy / len, dz / len, len - 0.2, Groups.rayCamera)
  }

  dispose() {
    this.events.free()
    this.world.free()
    this.owners.clear()
  }
}
