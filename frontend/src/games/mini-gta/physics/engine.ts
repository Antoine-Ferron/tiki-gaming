import {
  Body,
  Box,
  Broadphase,
  type ContactEquation,
  Heightfield,
  Material,
  Quaternion,
  Sphere,
  Vec3,
  World as CannonWorld,
  type Shape,
} from 'cannon-es'

/**
 * Moteur physique de MiniGTA, sans WebAssembly (la CSP de la plateforme interdit la compilation WASM).
 *
 * Il reprend le sous-ensemble de l'API Rapier utilisé par le jeu (corps, colliders, groupes de collision,
 * raycasts, contrôleurs de véhicule et de personnage) :
 * - cannon-es ne simule que les contacts des corps mobiles (véhicules, débris, grenades) ;
 * - raycasts et tests de forme passent par une grille spatiale maison : les obstacles statiques de la ville
 *   ne tournent qu'autour de Y, ce qui rend ces requêtes rapides ;
 * - le contrôleur de véhicule est un port du « raycast vehicle » de Bullet (comme celui de Rapier) ;
 * - le contrôleur de personnage est un contrôleur 2,5D : cercle contre rectangles orientés, sol par heightfield.
 */

export type Vec = { x: number; y: number; z: number }
export type Rot = { x: number; y: number; z: number; w: number }

export const ActiveEvents = { NONE: 0, COLLISION_EVENTS: 1, CONTACT_FORCE_EVENTS: 2 } as const

export const RigidBodyType = { Dynamic: 0, Fixed: 1, KinematicPositionBased: 2 } as const
export type RigidBodyType = (typeof RigidBodyType)[keyof typeof RigidBodyType]

const ALL_GROUPS = 0xffffffff
/** Profondeur (m) au-delà de laquelle un contact est un dégagement et ne compte pas comme un choc. */
const DEEP_PENETRATION = 0.15

/** Groupes façon Rapier : 16 bits de poids fort = appartenance, 16 bits de poids faible = filtre. */
export function groupsInteract(a: number, b: number): boolean {
  return ((a >>> 16) & b & 0xffff) !== 0 && ((b >>> 16) & a & 0xffff) !== 0
}

type Geometry =
  | { kind: 'cuboid'; hx: number; hy: number; hz: number }
  | { kind: 'ball'; r: number }
  | { kind: 'capsule'; half: number; r: number }
  | { kind: 'heightfield'; n: number; heights: Float32Array; size: number }

// ---------------------------------------------------------------------------------------------
// Petites opérations vectorielles sur des objets simples (pas d'allocation de Vector3 de three).

const quatRotate = (q: Rot, v: Vec, out: Vec): Vec => {
  const ix = q.w * v.x + q.y * v.z - q.z * v.y
  const iy = q.w * v.y + q.z * v.x - q.x * v.z
  const iz = q.w * v.z + q.x * v.y - q.y * v.x
  const iw = -q.x * v.x - q.y * v.y - q.z * v.z
  out.x = ix * q.w + iw * -q.x + iy * -q.z - iz * -q.y
  out.y = iy * q.w + iw * -q.y + iz * -q.x - ix * -q.z
  out.z = iz * q.w + iw * -q.z + ix * -q.y - iy * -q.x
  return out
}
const quatConj = (q: Rot): Rot => ({ x: -q.x, y: -q.y, z: -q.z, w: q.w })
const quatMul = (a: Rot, b: Rot): Rot => ({
  x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
  y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
  z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
  w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
})
const dot = (a: Vec, b: Vec) => a.x * b.x + a.y * b.y + a.z * b.z
const cross = (a: Vec, b: Vec): Vec => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
})
const IDENTITY: Rot = { x: 0, y: 0, z: 0, w: 1 }

// ---------------------------------------------------------------------------------------------
// Descripteurs

export class RigidBodyDesc {
  translation: Vec = { x: 0, y: 0, z: 0 }
  rotation: Rot = { ...IDENTITY }
  linvel: Vec = { x: 0, y: 0, z: 0 }
  linearDamping = 0
  angularDamping = 0
  canSleep = true
  ccd = false

  private constructor(readonly type: RigidBodyType) {}
  static fixed() {
    return new RigidBodyDesc(RigidBodyType.Fixed)
  }
  static dynamic() {
    return new RigidBodyDesc(RigidBodyType.Dynamic)
  }
  static kinematicPositionBased() {
    return new RigidBodyDesc(RigidBodyType.KinematicPositionBased)
  }
  setTranslation(x: number, y: number, z: number) {
    this.translation = { x, y, z }
    return this
  }
  setRotation(r: Rot) {
    this.rotation = { ...r }
    return this
  }
  setLinvel(x: number, y: number, z: number) {
    this.linvel = { x, y, z }
    return this
  }
  setLinearDamping(d: number) {
    this.linearDamping = d
    return this
  }
  setAngularDamping(d: number) {
    this.angularDamping = d
    return this
  }
  setCanSleep(v: boolean) {
    this.canSleep = v
    return this
  }
  setCcdEnabled(v: boolean) {
    this.ccd = v
    return this
  }
}

export class ColliderDesc {
  translation: Vec = { x: 0, y: 0, z: 0 }
  rotation: Rot = { ...IDENTITY }
  mass: number | null = null
  friction = 0.5
  restitution = 0
  groups = ALL_GROUPS
  activeEvents = 0
  forceThreshold = 0

  private constructor(readonly geometry: Geometry) {}
  static cuboid(hx: number, hy: number, hz: number) {
    return new ColliderDesc({ kind: 'cuboid', hx, hy, hz })
  }
  static ball(r: number) {
    return new ColliderDesc({ kind: 'ball', r })
  }
  static capsule(half: number, r: number) {
    return new ColliderDesc({ kind: 'capsule', half, r })
  }
  /** Grille (n+1)² indexée ix * (n+1) + iz, centrée sur l'origine, de côté `size`. */
  static heightfield(n: number, heights: Float32Array, size: number) {
    return new ColliderDesc({ kind: 'heightfield', n, heights, size })
  }
  setTranslation(x: number, y: number, z: number) {
    this.translation = { x, y, z }
    return this
  }
  setRotation(r: Rot) {
    this.rotation = { ...r }
    return this
  }
  setMass(m: number) {
    this.mass = m
    return this
  }
  setFriction(f: number) {
    this.friction = f
    return this
  }
  setRestitution(r: number) {
    this.restitution = r
    return this
  }
  setCollisionGroups(g: number) {
    this.groups = g
    return this
  }
  setActiveEvents(e: number) {
    this.activeEvents = e
    return this
  }
  setContactForceEventThreshold(t: number) {
    this.forceThreshold = t
    return this
  }
}

/** Forme d'un test d'intersection (seule la sphère est utilisée par le jeu). */
export class Ball {
  constructor(readonly radius: number) {}
}

// ---------------------------------------------------------------------------------------------
// Colliders et corps

function volume(g: Geometry): number {
  switch (g.kind) {
    case 'cuboid':
      return 8 * g.hx * g.hy * g.hz
    case 'ball':
      return (4 / 3) * Math.PI * g.r ** 3
    case 'capsule':
      return Math.PI * g.r * g.r * (2 * g.half + (4 / 3) * g.r)
    case 'heightfield':
      return 0
  }
}

export class Collider {
  readonly geometry: Geometry
  readonly local: Vec
  readonly localRot: Rot
  readonly mass: number
  readonly friction: number
  readonly restitution: number
  readonly groups: number
  readonly activeEvents: number
  readonly forceThreshold: number
  enabled = true
  valid = true
  /** Formes cannon-es du collider (une sphère par extrémité pour une capsule). */
  shapes: Shape[] = []
  /** Corps cannon-es propre au collider, pour un collider d'un corps fixe. */
  staticBody: Body | null = null
  /** Boîte englobante (corps fixes) et cellules de grille occupées. */
  aabb = { minX: 0, minY: 0, minZ: 0, maxX: 0, maxY: 0, maxZ: 0 }
  cells: number[] = []
  stamp = 0
  /** Dernier pas où un corps mobile était proche (colliders fixes chargés dans cannon-es à la demande). */
  lastUsed = -1
  private readonly world = { x: 0, y: 0, z: 0 }
  private worldRot: Rot = { ...IDENTITY }

  constructor(
    readonly handle: number,
    desc: ColliderDesc,
    readonly body: RigidBody,
  ) {
    this.geometry = desc.geometry
    this.local = { ...desc.translation }
    this.localRot = { ...desc.rotation }
    this.mass = desc.mass ?? volume(desc.geometry)
    this.friction = desc.friction
    this.restitution = desc.restitution
    this.groups = desc.groups
    this.activeEvents = desc.activeEvents
    this.forceThreshold = desc.forceThreshold
  }

  parent(): RigidBody {
    return this.body
  }
  isSensor() {
    return false
  }
  isValid() {
    return this.valid
  }
  setEnabled(enabled: boolean) {
    this.enabled = enabled
    for (const s of this.shapes) s.collisionResponse = enabled
  }

  /** Position du centre du collider dans le monde. */
  position(): Vec {
    this.body.originRot(this.worldRot)
    quatRotate(this.worldRot, this.local, this.world)
    const o = this.body.translation()
    this.world.x += o.x
    this.world.y += o.y
    this.world.z += o.z
    return this.world
  }

  rotation(): Rot {
    return quatMul(this.body.rotation(), this.localRot)
  }

  /** Rayon de la sphère englobante. */
  boundingRadius(): number {
    const g = this.geometry
    if (g.kind === 'cuboid') return Math.hypot(g.hx, g.hy, g.hz)
    if (g.kind === 'ball') return g.r
    if (g.kind === 'capsule') return g.half + g.r
    return Infinity
  }
}

export class RigidBody {
  readonly colliders: Collider[] = []
  /** Corps cannon-es (corps dynamiques et cinématiques). Un corps fixe n'en a pas : ses colliders ont le leur. */
  readonly cbody: Body | null
  /** Centre de masse dans le repère du corps : cannon-es place l'origine du corps au centre de masse. */
  readonly com: Vec = { x: 0, y: 0, z: 0 }
  enabled = true
  ccd: boolean
  private fixedPos: Vec
  private fixedRot: Rot
  private next: { pos: Vec; rot: Rot } | null = null

  constructor(
    readonly handle: number,
    public type: RigidBodyType,
    desc: RigidBodyDesc,
    private readonly world: World,
  ) {
    this.fixedPos = { ...desc.translation }
    this.fixedRot = { ...desc.rotation }
    this.ccd = desc.ccd
    if (type === RigidBodyType.Fixed) {
      this.cbody = null
      return
    }
    const b = new Body({ mass: 0, type: type === RigidBodyType.Dynamic ? Body.DYNAMIC : Body.KINEMATIC })
    b.position.set(desc.translation.x, desc.translation.y, desc.translation.z)
    b.quaternion.set(desc.rotation.x, desc.rotation.y, desc.rotation.z, desc.rotation.w)
    b.velocity.set(desc.linvel.x, desc.linvel.y, desc.linvel.z)
    // Amortissement de Rapier : v ← v / (1 + d·dt) ; cannon-es : v ← v · (1 − d')^dt.
    b.linearDamping = 1 - Math.exp(-desc.linearDamping)
    b.angularDamping = 1 - Math.exp(-desc.angularDamping)
    b.allowSleep = desc.canSleep
    b.sleepSpeedLimit = 0.2
    b.sleepTimeLimit = 0.6
    this.cbody = b
  }

  /** Position de l'origine du corps (et non du centre de masse). */
  translation(): Vec {
    const b = this.cbody
    if (!b) return { ...this.fixedPos }
    const c = quatRotate(b.quaternion, this.com, { x: 0, y: 0, z: 0 })
    return { x: b.position.x - c.x, y: b.position.y - c.y, z: b.position.z - c.z }
  }

  rotation(): Rot {
    const b = this.cbody
    if (!b) return { ...this.fixedRot }
    return { x: b.quaternion.x, y: b.quaternion.y, z: b.quaternion.z, w: b.quaternion.w }
  }

  originRot(out: Rot) {
    const r = this.cbody ? this.cbody.quaternion : this.fixedRot
    out.x = r.x
    out.y = r.y
    out.z = r.z
    out.w = r.w
  }

  /** Centre de masse dans le monde. */
  centerOfMass(): Vec {
    const b = this.cbody
    if (!b) return { ...this.fixedPos }
    return { x: b.position.x, y: b.position.y, z: b.position.z }
  }

  linvel(): Vec {
    const v = this.cbody?.velocity
    return v ? { x: v.x, y: v.y, z: v.z } : { x: 0, y: 0, z: 0 }
  }

  angvel(): Vec {
    const w = this.cbody?.angularVelocity
    return w ? { x: w.x, y: w.y, z: w.z } : { x: 0, y: 0, z: 0 }
  }

  /** Vitesse d'un point du monde lié au corps. */
  velocityAt(p: Vec): Vec {
    const b = this.cbody
    if (!b) return { x: 0, y: 0, z: 0 }
    const r = { x: p.x - b.position.x, y: p.y - b.position.y, z: p.z - b.position.z }
    const w = cross(b.angularVelocity, r)
    return { x: b.velocity.x + w.x, y: b.velocity.y + w.y, z: b.velocity.z + w.z }
  }

  isDynamic() {
    return this.type === RigidBodyType.Dynamic
  }

  get invMass() {
    return this.isDynamic() && this.cbody ? this.cbody.invMass : 0
  }

  mass() {
    return this.cbody?.mass ?? 0
  }

  setLinvel(v: Vec, wake: boolean) {
    this.cbody?.velocity.set(v.x, v.y, v.z)
    if (wake) this.wakeUp()
  }

  setAngvel(v: Vec, wake: boolean) {
    this.cbody?.angularVelocity.set(v.x, v.y, v.z)
    if (wake) this.wakeUp()
  }

  applyImpulse(i: Vec, wake: boolean) {
    const b = this.cbody
    if (!b || !this.isDynamic()) return
    b.velocity.x += i.x * b.invMass
    b.velocity.y += i.y * b.invMass
    b.velocity.z += i.z * b.invMass
    if (wake) this.wakeUp()
  }

  applyTorqueImpulse(t: Vec, wake: boolean) {
    const b = this.cbody
    if (!b || !this.isDynamic()) return
    const dw = b.invInertiaWorld.vmult(new Vec3(t.x, t.y, t.z))
    b.angularVelocity.vadd(dw, b.angularVelocity)
    if (wake) this.wakeUp()
  }

  applyImpulseAtPoint(i: Vec, p: Vec, wake: boolean) {
    const b = this.cbody
    if (!b || !this.isDynamic()) return
    this.applyImpulse(i, false)
    const r = { x: p.x - b.position.x, y: p.y - b.position.y, z: p.z - b.position.z }
    this.applyTorqueImpulse(cross(r, i), false)
    if (wake) this.wakeUp()
  }

  /** Dénominateur d'impulsion (inverse de la masse effective) au point p selon la direction n. */
  impulseDenominator(p: Vec, n: Vec): number {
    const b = this.cbody
    if (!b || !this.isDynamic()) return 0
    const r = { x: p.x - b.position.x, y: p.y - b.position.y, z: p.z - b.position.z }
    const rn = cross(r, n)
    const ii = b.invInertiaWorld.vmult(new Vec3(rn.x, rn.y, rn.z))
    return b.invMass + dot(n, cross(ii, r))
  }

  setTranslation(p: Vec, wake: boolean) {
    const b = this.cbody
    if (!b) {
      this.fixedPos = { ...p }
      return
    }
    const c = quatRotate(b.quaternion, this.com, { x: 0, y: 0, z: 0 })
    b.position.set(p.x + c.x, p.y + c.y, p.z + c.z)
    b.previousPosition.copy(b.position)
    b.interpolatedPosition.copy(b.position)
    b.aabbNeedsUpdate = true
    if (wake) this.wakeUp()
  }

  setRotation(r: Rot, wake: boolean) {
    const b = this.cbody
    if (!b) {
      this.fixedRot = { ...r }
      return
    }
    const origin = this.translation()
    b.quaternion.set(r.x, r.y, r.z, r.w)
    b.previousQuaternion.copy(b.quaternion)
    b.interpolatedQuaternion.copy(b.quaternion)
    this.setTranslation(origin, wake)
  }

  setNextKinematicTranslation(p: Vec) {
    this.next = { pos: { ...p }, rot: this.next?.rot ?? this.rotation() }
  }

  setNextKinematicRotation(r: Rot) {
    this.next = { pos: this.next?.pos ?? this.translation(), rot: { ...r } }
  }

  setBodyType(type: RigidBodyType, wake: boolean) {
    const b = this.cbody
    if (!b || type === this.type || type === RigidBodyType.Fixed) return
    this.type = type
    this.next = null
    b.type = type === RigidBodyType.Dynamic ? Body.DYNAMIC : Body.KINEMATIC
    this.world.updateMass(this)
    if (wake) this.wakeUp()
  }

  setEnabled(enabled: boolean) {
    if (enabled === this.enabled) return
    this.enabled = enabled
    this.world.setBodyEnabled(this, enabled)
  }

  sleep() {
    this.cbody?.sleep()
  }

  wakeUp() {
    this.cbody?.wakeUp()
  }

  numColliders() {
    return this.colliders.length
  }

  collider(i: number) {
    return this.colliders[i]
  }

  /** Avant le pas : un corps cinématique reçoit la vitesse qui l'amène à sa cible. */
  prepareKinematic(dt: number) {
    const b = this.cbody
    const next = this.next
    if (!b || this.type !== RigidBodyType.KinematicPositionBased || !next) return
    const c = quatRotate(next.rot, this.com, { x: 0, y: 0, z: 0 })
    b.velocity.set(
      (next.pos.x + c.x - b.position.x) / dt,
      (next.pos.y + c.y - b.position.y) / dt,
      (next.pos.z + c.z - b.position.z) / dt,
    )
    // Rotation : q_delta = cible · courante⁻¹, convertie en vitesse angulaire.
    let d = quatMul(next.rot, quatConj(b.quaternion))
    if (d.w < 0) d = { x: -d.x, y: -d.y, z: -d.z, w: -d.w }
    const s = Math.hypot(d.x, d.y, d.z)
    const angle = 2 * Math.atan2(s, d.w)
    if (s > 1e-9) b.angularVelocity.set((d.x / s) * (angle / dt), (d.y / s) * (angle / dt), (d.z / s) * (angle / dt))
    else b.angularVelocity.set(0, 0, 0)
  }

  /** Après le pas : le corps cinématique est posé exactement sur sa cible. */
  finishKinematic() {
    const b = this.cbody
    const next = this.next
    if (!b || this.type !== RigidBodyType.KinematicPositionBased || !next) return
    b.quaternion.set(next.rot.x, next.rot.y, next.rot.z, next.rot.w)
    const c = quatRotate(next.rot, this.com, { x: 0, y: 0, z: 0 })
    b.position.set(next.pos.x + c.x, next.pos.y + c.y, next.pos.z + c.z)
    b.aabbNeedsUpdate = true
  }
}

// ---------------------------------------------------------------------------------------------
// Événements

export interface ContactForceEvent {
  collider1(): number
  collider2(): number
  totalForceMagnitude(): number
  maxForceDirection(): Vec
}

export class EventQueue {
  forces: ContactForceEvent[] = []
  collisions: [number, number, boolean][] = []

  /** autoDrain : accepté pour l'API de Rapier, les événements sont toujours vidés par drain*. */
  constructor(autoDrain = true) {
    void autoDrain
  }

  drainContactForceEvents(cb: (e: ContactForceEvent) => void) {
    const list = this.forces
    this.forces = []
    for (const e of list) cb(e)
  }

  drainCollisionEvents(cb: (h1: number, h2: number, started: boolean) => void) {
    const list = this.collisions
    this.collisions = []
    for (const [a, b, s] of list) cb(a, b, s)
  }

  free() {
    this.forces = []
    this.collisions = []
  }
}

// ---------------------------------------------------------------------------------------------
// Grille spatiale des colliders fixes

const CELL = 32
const GRID_OFFSET = 4096
const cellKey = (ix: number, iz: number) => (ix + GRID_OFFSET) * 8192 + (iz + GRID_OFFSET)

class StaticGrid {
  private cells = new Map<number, Collider[]>()

  insert(c: Collider) {
    const a = c.aabb
    const x0 = Math.floor(a.minX / CELL)
    const x1 = Math.floor(a.maxX / CELL)
    const z0 = Math.floor(a.minZ / CELL)
    const z1 = Math.floor(a.maxZ / CELL)
    for (let ix = x0; ix <= x1; ix++) {
      for (let iz = z0; iz <= z1; iz++) {
        const k = cellKey(ix, iz)
        let list = this.cells.get(k)
        if (!list) this.cells.set(k, (list = []))
        list.push(c)
        c.cells.push(k)
      }
    }
  }

  remove(c: Collider) {
    for (const k of c.cells) {
      const list = this.cells.get(k)
      if (!list) continue
      const i = list.indexOf(c)
      if (i >= 0) list.splice(i, 1)
    }
    c.cells = []
  }

  cell(ix: number, iz: number): Collider[] | undefined {
    return this.cells.get(cellKey(ix, iz))
  }

  /** Visite chaque collider (une seule fois) dont la cellule touche le rectangle donné. */
  forEachIn(minX: number, minZ: number, maxX: number, maxZ: number, stamp: number, cb: (c: Collider) => void) {
    const x0 = Math.floor(minX / CELL)
    const x1 = Math.floor(maxX / CELL)
    const z0 = Math.floor(minZ / CELL)
    const z1 = Math.floor(maxZ / CELL)
    for (let ix = x0; ix <= x1; ix++) {
      for (let iz = z0; iz <= z1; iz++) {
        const list = this.cells.get(cellKey(ix, iz))
        if (!list) continue
        for (const c of list) {
          if (c.stamp === stamp) continue
          c.stamp = stamp
          cb(c)
        }
      }
    }
  }
}

/**
 * Broadphase de cannon-es : seuls les corps mobiles cherchent des paires, contre la grille statique,
 * le terrain et les autres corps mobiles. Les milliers de boîtes de la ville ne sont jamais balayées.
 */
class GridBroadphase extends Broadphase {
  constructor(private readonly owner: World) {
    super()
  }

  override collisionPairs(world: CannonWorld, p1: Body[], p2: Body[]) {
    const movers = this.owner.movingBodies()
    for (const b of movers) if (b.aabbNeedsUpdate) b.updateAABB()
    for (let i = 0; i < movers.length; i++) {
      const a = movers[i]
      const awake = a.type === Body.DYNAMIC && a.sleepState !== Body.SLEEPING
      if (awake) {
        const box = a.aabb
        const stamp = this.owner.nextStamp()
        this.owner.grid.forEachIn(
          box.lowerBound.x,
          box.lowerBound.z,
          box.upperBound.x,
          box.upperBound.z,
          stamp,
          (c) => {
            const s = c.staticBody
            if (s && c.enabled && this.owner.isLoaded(c) && this.needBroadphaseCollision(a, s)) {
              this.doBoundingBoxBroadphase(a, s, p1, p2)
            }
          },
        )
        for (const t of this.owner.terrainBodies)
          if (this.needBroadphaseCollision(a, t)) this.doBoundingBoxBroadphase(a, t, p1, p2)
      }
      for (let j = i + 1; j < movers.length; j++) {
        const b = movers[j]
        if (this.needBroadphaseCollision(a, b)) this.doBoundingBoxBroadphase(a, b, p1, p2)
      }
    }
    void world
  }
}

// ---------------------------------------------------------------------------------------------
// Monde

export interface RayHit {
  collider: Collider
  timeOfImpact: number
  normal: Vec
}

type Predicate = (c: Collider) => boolean

export class World {
  readonly cworld: CannonWorld
  readonly grid = new StaticGrid()
  readonly terrainBodies: Body[] = []
  timestep = 1 / 60
  private bodies = new Set<RigidBody>()
  private moving: Body[] = []
  private movingDirty = true
  private dynamicColliders: Collider[] = []
  private heightfields: Collider[] = []
  private colliders = new Map<number, Collider>()
  private shapeOwner = new Map<Shape, Collider>()
  private materials = new Map<string, Material>()
  private nextHandle = 1
  private stamp = 1
  /** Colliders fixes présents dans cannon-es : seulement ceux proches d'un corps mobile. */
  private activeStatics = new Set<Collider>()
  private steps = 0
  private activePairs = new Set<string>()
  private before = new Map<Body, { v: Vec; w: Vec }>()

  constructor(gravity: Vec) {
    this.cworld = new CannonWorld({ gravity: new Vec3(gravity.x, gravity.y, gravity.z), allowSleep: true })
    this.cworld.broadphase = new GridBroadphase(this)
    ;(this.cworld.solver as unknown as { iterations: number }).iterations = 10
  }

  nextStamp() {
    return ++this.stamp
  }

  movingBodies(): Body[] {
    if (this.movingDirty) {
      this.moving = []
      for (const b of this.bodies) if (b.cbody && b.enabled && b.colliders.length) this.moving.push(b.cbody)
      this.movingDirty = false
    }
    return this.moving
  }

  private material(friction: number, restitution: number) {
    const key = `${friction}:${restitution}`
    let m = this.materials.get(key)
    if (!m) this.materials.set(key, (m = new Material({ friction, restitution })))
    return m
  }

  createRigidBody(desc: RigidBodyDesc): RigidBody {
    const body = new RigidBody(this.nextHandle++, desc.type, desc, this)
    this.bodies.add(body)
    if (body.cbody) this.cworld.addBody(body.cbody)
    this.movingDirty = true
    return body
  }

  createCollider(desc: ColliderDesc, body: RigidBody): Collider {
    const c = new Collider(this.nextHandle++, desc, body)
    body.colliders.push(c)
    this.colliders.set(c.handle, c)
    const mat = this.material(desc.friction, desc.restitution)
    const shapes = this.makeShapes(c)
    for (const { shape } of shapes) {
      shape.material = mat
      shape.collisionFilterGroup = (c.groups >>> 16) & 0xffff
      shape.collisionFilterMask = c.groups & 0xffff
      this.shapeOwner.set(shape, c)
      c.shapes.push(shape)
    }
    if (!body.cbody) {
      // Collider d'un corps fixe : son propre corps statique cannon-es, dans la grille.
      const pos = c.position()
      const rot = c.rotation()
      const sb = new Body({ mass: 0, type: Body.STATIC })
      sb.collisionFilterGroup = (c.groups >>> 16) & 0xffff
      sb.collisionFilterMask = c.groups & 0xffff
      sb.position.set(pos.x, pos.y, pos.z)
      sb.quaternion.set(rot.x, rot.y, rot.z, rot.w)
      for (const { shape, offset, orientation } of shapes) sb.addShape(shape, offset, orientation)
      sb.updateAABB()
      c.staticBody = sb
      if (c.geometry.kind === 'heightfield') {
        this.cworld.addBody(sb)
        this.heightfields.push(c)
        this.terrainBodies.push(sb)
      } else {
        const a = sb.aabb
        c.aabb = {
          minX: a.lowerBound.x,
          minY: a.lowerBound.y,
          minZ: a.lowerBound.z,
          maxX: a.upperBound.x,
          maxY: a.upperBound.y,
          maxZ: a.upperBound.z,
        }
        this.grid.insert(c)
      }
    } else {
      const b = body.cbody
      for (const { shape, offset, orientation } of shapes) b.addShape(shape, offset, orientation)
      b.collisionFilterGroup |= (c.groups >>> 16) & 0xffff
      b.collisionFilterMask |= c.groups & 0xffff
      this.dynamicColliders.push(c)
      this.updateMass(body)
      this.movingDirty = true
    }
    return c
  }

  /** Formes cannon-es d'un collider, avec leur décalage dans le repère du corps (avant recentrage). */
  private makeShapes(c: Collider): { shape: Shape; offset: Vec3; orientation: Quaternion }[] {
    const g = c.geometry
    const fixed = !c.body.cbody
    // Pour un corps fixe, le corps statique est déjà placé sur le collider : pas de décalage.
    const base = fixed ? { x: 0, y: 0, z: 0 } : c.local
    const rot = fixed ? IDENTITY : c.localRot
    const at = (dx: number, dy: number, dz: number) => {
      const d = quatRotate(rot, { x: dx, y: dy, z: dz }, { x: 0, y: 0, z: 0 })
      return new Vec3(base.x + d.x, base.y + d.y, base.z + d.z)
    }
    const q = new Quaternion(rot.x, rot.y, rot.z, rot.w)
    switch (g.kind) {
      case 'cuboid':
        return [{ shape: new Box(new Vec3(g.hx, g.hy, g.hz)), offset: at(0, 0, 0), orientation: q }]
      case 'ball':
        return [{ shape: new Sphere(g.r), offset: at(0, 0, 0), orientation: q }]
      case 'capsule':
        // Capsule approchée par trois sphères pour les contacts ; les requêtes utilisent la vraie capsule.
        return [-g.half, 0, g.half].map((dy) => ({ shape: new Sphere(g.r), offset: at(0, dy, 0), orientation: q }))
      case 'heightfield': {
        // cannon-es : hauteurs selon Z local. Rotation de −90° autour de X : (x, y, z) local → (x, z, −y) monde.
        const n = g.n
        const res = g.size / n
        const data: number[][] = []
        for (let xi = 0; xi <= n; xi++) {
          const row: number[] = []
          for (let yi = 0; yi <= n; yi++) row.push(g.heights[xi * (n + 1) + (n - yi)])
          data.push(row)
        }
        const hf = new Heightfield(data, { elementSize: res })
        const o = new Quaternion()
        o.setFromAxisAngle(new Vec3(1, 0, 0), -Math.PI / 2)
        return [{ shape: hf, offset: new Vec3(-g.size / 2, 0, g.size / 2), orientation: o }]
      }
    }
  }

  /** Masse et centre de masse d'un corps mobile, recalculés à partir de ses colliders. */
  updateMass(body: RigidBody) {
    const b = body.cbody
    if (!b) return
    const origin = body.translation()
    let m = 0
    let cx = 0
    let cy = 0
    let cz = 0
    for (const c of body.colliders) {
      m += c.mass
      cx += c.local.x * c.mass
      cy += c.local.y * c.mass
      cz += c.local.z * c.mass
    }
    const com = m > 0 ? { x: cx / m, y: cy / m, z: cz / m } : { x: 0, y: 0, z: 0 }
    const shift = { x: com.x - body.com.x, y: com.y - body.com.y, z: com.z - body.com.z }
    for (const off of b.shapeOffsets) off.set(off.x - shift.x, off.y - shift.y, off.z - shift.z)
    body.com.x = com.x
    body.com.y = com.y
    body.com.z = com.z
    b.mass = body.isDynamic() ? m : 0
    b.updateMassProperties()
    b.updateBoundingRadius()
    body.setTranslation(origin, false)
  }

  setBodyEnabled(body: RigidBody, enabled: boolean) {
    if (body.cbody) {
      if (enabled) this.cworld.addBody(body.cbody)
      else this.cworld.removeBody(body.cbody)
    }
    this.movingDirty = true
  }

  getCollider(handle: number): Collider | undefined {
    return this.colliders.get(handle)
  }

  removeCollider(c: Collider, wake = true) {
    void wake
    if (!c.valid) return
    c.valid = false
    this.colliders.delete(c.handle)
    for (const s of c.shapes) this.shapeOwner.delete(s)
    const body = c.body
    body.colliders.splice(body.colliders.indexOf(c), 1)
    if (c.staticBody) {
      if (this.activeStatics.delete(c) || c.geometry.kind === 'heightfield') this.cworld.removeBody(c.staticBody)
      this.grid.remove(c)
      const i = this.heightfields.indexOf(c)
      if (i >= 0) {
        this.heightfields.splice(i, 1)
        this.terrainBodies.splice(this.terrainBodies.indexOf(c.staticBody), 1)
      }
    } else if (body.cbody) {
      for (const s of c.shapes) {
        const i = body.cbody.shapes.indexOf(s)
        if (i >= 0) body.cbody.removeShape(s)
      }
      this.dynamicColliders.splice(this.dynamicColliders.indexOf(c), 1)
      this.updateMass(body)
    }
    this.movingDirty = true
  }

  removeRigidBody(body: RigidBody) {
    for (const c of [...body.colliders]) this.removeCollider(c)
    if (body.cbody) this.cworld.removeBody(body.cbody)
    this.bodies.delete(body)
    this.movingDirty = true
  }

  step(events?: EventQueue) {
    const dt = this.timestep
    for (const b of this.bodies) {
      if (!b.enabled) continue
      b.prepareKinematic(dt)
      if (b.ccd && b.isDynamic()) this.sweep(b, dt)
    }
    // Vitesses avant le pas : elles mesurent la violence d'un choc (voir collectEvents).
    this.before.clear()
    for (const b of this.movingBodies()) {
      this.before.set(b, {
        v: { x: b.velocity.x, y: b.velocity.y, z: b.velocity.z },
        w: { x: b.angularVelocity.x, y: b.angularVelocity.y, z: b.angularVelocity.z },
      })
    }
    this.loadNearbyStatics(dt)
    this.cworld.step(dt)
    for (const b of this.bodies) if (b.enabled) b.finishKinematic()
    if (events) this.collectEvents(events)
  }

  isLoaded(c: Collider) {
    return this.activeStatics.has(c)
  }

  /**
   * cannon-es parcourt tous ses corps à chaque pas : y garder les milliers de boîtes de la ville coûterait
   * plus cher que toute la simulation. On n'y charge que les colliders fixes proches d'un corps dynamique,
   * et on décharge ceux qui ne servent plus depuis une seconde.
   */
  private loadNearbyStatics(dt: number) {
    const step = ++this.steps
    for (const body of this.bodies) {
      const b = body.cbody
      if (!b || !body.enabled || !body.isDynamic() || !body.colliders.length) continue
      if (b.aabbNeedsUpdate) b.updateAABB()
      const m = Math.hypot(b.velocity.x, b.velocity.y, b.velocity.z) * dt * 2 + 0.5
      const box = b.aabb
      this.grid.forEachIn(
        box.lowerBound.x - m,
        box.lowerBound.z - m,
        box.upperBound.x + m,
        box.upperBound.z + m,
        this.nextStamp(),
        (c) => {
          if (!c.staticBody || !c.valid) return
          c.lastUsed = step
          if (!this.activeStatics.has(c)) {
            this.activeStatics.add(c)
            this.cworld.addBody(c.staticBody)
          }
        },
      )
    }
    if (step % 30 !== 0) return
    for (const c of this.activeStatics) {
      if (step - c.lastUsed > 60) {
        this.activeStatics.delete(c)
        this.cworld.removeBody(c.staticBody!)
      }
    }
  }

  /** CCD minimal pour les petits corps rapides (grenades) : rebond sur le premier obstacle rencontré. */
  private sweep(body: RigidBody, dt: number) {
    const b = body.cbody!
    const v = b.velocity
    const len = Math.hypot(v.x, v.y, v.z) * dt
    const r = body.colliders[0]?.boundingRadius() ?? 0
    if (len < r) return
    const dir = { x: (v.x * dt) / len, y: (v.y * dt) / len, z: (v.z * dt) / len }
    const hit = this.castRayAndGetNormal(
      { origin: b.position, dir },
      len + r,
      true,
      undefined,
      body.colliders[0].groups,
      undefined,
      body,
    )
    if (!hit) return
    const t = Math.max(0, hit.timeOfImpact - r)
    b.position.set(b.position.x + dir.x * t, b.position.y + dir.y * t, b.position.z + dir.z * t)
    const n = hit.normal
    const vn = v.x * n.x + v.y * n.y + v.z * n.z
    if (vn < 0) {
      const e = 1 + (body.colliders[0]?.restitution ?? 0)
      v.set(v.x - e * vn * n.x, v.y - e * vn * n.y, v.z - e * vn * n.z)
    }
  }

  private collectEvents(events: EventQueue) {
    const dt = this.timestep
    const pairs = new Map<
      string,
      { a: Collider; b: Collider; force: number; max: number; dir: Vec; closing: number; mass: number }
    >()
    for (const eq of this.cworld.contacts) {
      const a = this.shapeOwner.get(eq.si)
      const b = this.shapeOwner.get(eq.sj)
      if (!a || !b || !(a.activeEvents | b.activeEvents)) continue
      const key = a.handle < b.handle ? `${a.handle}:${b.handle}` : `${b.handle}:${a.handle}`
      // Interpénétration profonde (apparition dans un obstacle) : c'est un dégagement, pas un choc.
      const f = penetration(eq) < -DEEP_PENETRATION ? 0 : Math.abs(eq.multiplier)
      let p = pairs.get(key)
      if (!p) {
        const inv = eq.bi.invMass + eq.bj.invMass
        p = { a, b, force: 0, max: -1, dir: { x: 0, y: 0, z: 0 }, closing: 0, mass: inv > 0 ? 1 / inv : 0 }
        pairs.set(key, p)
      }
      p.force += f
      p.closing = Math.max(p.closing, this.closingSpeed(eq))
      if (f > p.max) {
        p.max = f
        p.dir = { x: eq.ni.x, y: eq.ni.y, z: eq.ni.z }
      }
    }
    // La force du solveur inclut la correction d'interpénétration, qui fait des pics. Comme Rapier, on ne
    // garde que la force qui arrête la vitesse d'approche d'avant le pas, plus le poids (contact au repos).
    for (const p of pairs.values()) p.force = Math.min(p.force, p.mass * (p.closing / dt + 2 * 9.81))
    const active = new Set<string>()
    for (const [key, p] of pairs) {
      const flags = p.a.activeEvents | p.b.activeEvents
      if (flags & ActiveEvents.COLLISION_EVENTS) {
        active.add(key)
        if (!this.activePairs.has(key)) events.collisions.push([p.a.handle, p.b.handle, true])
      }
      if (flags & ActiveEvents.CONTACT_FORCE_EVENTS) {
        const thresholds = [p.a, p.b].filter((c) => c.activeEvents & ActiveEvents.CONTACT_FORCE_EVENTS)
        const threshold = Math.min(...thresholds.map((c) => c.forceThreshold))
        if (p.force > threshold) {
          const { a, b, force, dir } = p
          events.forces.push({
            collider1: () => a.handle,
            collider2: () => b.handle,
            totalForceMagnitude: () => force,
            maxForceDirection: () => dir,
          })
        }
      }
    }
    for (const key of this.activePairs) {
      if (!active.has(key)) {
        const [h1, h2] = key.split(':').map(Number)
        events.collisions.push([h1, h2, false])
      }
    }
    this.activePairs = active
  }

  /** Vitesse à laquelle les deux corps d'un contact se rapprochaient avant le pas (0 s'ils s'éloignaient). */
  private closingSpeed(eq: ContactEquation): number {
    const at = (body: Body, r: Vec3) => {
      const s = this.before.get(body)
      if (!s) return { x: 0, y: 0, z: 0 }
      const w = cross(s.w, r)
      return { x: s.v.x + w.x, y: s.v.y + w.y, z: s.v.z + w.z }
    }
    const vi = at(eq.bi, eq.ri)
    const vj = at(eq.bj, eq.rj)
    return Math.max(0, (vi.x - vj.x) * eq.ni.x + (vi.y - vj.y) * eq.ni.y + (vi.z - vj.z) * eq.ni.z)
  }

  // -------------------------------------------------------------------------------------------
  // Requêtes

  private accepts(c: Collider, groups: number, excludeBody?: RigidBody, predicate?: Predicate) {
    return (
      c.valid &&
      c.enabled &&
      c.body.enabled &&
      c.body !== excludeBody &&
      groupsInteract(groups, c.groups) &&
      (!predicate || predicate(c))
    )
  }

  /** Raycast façon Rapier : premier collider touché, distance et normale. */
  castRayAndGetNormal(
    ray: { origin: Vec; dir: Vec },
    maxToi: number,
    solid: boolean,
    _flags?: number,
    groups: number = ALL_GROUPS,
    _excludeCollider?: Collider,
    excludeBody?: RigidBody,
    predicate?: Predicate,
  ): RayHit | null {
    const o = ray.origin
    const d = ray.dir
    let best: RayHit | null = null
    let bestT = maxToi
    const test = (c: Collider) => {
      if (!this.accepts(c, groups, excludeBody, predicate)) return
      const hit = rayCollider(c, o, d, bestT, solid)
      if (hit && hit.t <= bestT) {
        bestT = hit.t
        best = { collider: c, timeOfImpact: hit.t, normal: hit.n }
      }
    }
    for (const c of this.heightfields) test(c)
    for (const c of this.dynamicColliders) {
      if (!c.body.enabled) continue
      const p = c.position()
      const r = c.boundingRadius()
      // Rejet rapide par la sphère englobante.
      const px = p.x - o.x
      const py = p.y - o.y
      const pz = p.z - o.z
      const t = px * d.x + py * d.y + pz * d.z
      if (t < -r || t > bestT + r) continue
      const cx = px - d.x * t
      const cy = py - d.y * t
      const cz = pz - d.z * t
      if (cx * cx + cy * cy + cz * cz > r * r) continue
      test(c)
    }
    this.traverseGrid(o, d, () => bestT, test)
    return best
  }

  /** Parcours DDA des cellules de la grille traversées par le rayon, jusqu'à la meilleure distance connue. */
  private traverseGrid(o: Vec, d: Vec, maxT: () => number, test: (c: Collider) => void) {
    const stamp = this.nextStamp()
    let ix = Math.floor(o.x / CELL)
    let iz = Math.floor(o.z / CELL)
    const stepX = d.x > 0 ? 1 : -1
    const stepZ = d.z > 0 ? 1 : -1
    const tdx = Math.abs(d.x) > 1e-9 ? CELL / Math.abs(d.x) : Infinity
    const tdz = Math.abs(d.z) > 1e-9 ? CELL / Math.abs(d.z) : Infinity
    let tx = Math.abs(d.x) > 1e-9 ? ((d.x > 0 ? (ix + 1) * CELL : ix * CELL) - o.x) / d.x : Infinity
    let tz = Math.abs(d.z) > 1e-9 ? ((d.z > 0 ? (iz + 1) * CELL : iz * CELL) - o.z) / d.z : Infinity
    let tEnter = 0
    for (let i = 0; i < 256 && tEnter <= maxT(); i++) {
      const list = this.grid.cell(ix, iz)
      if (list) {
        for (const c of list) {
          if (c.stamp === stamp) continue
          c.stamp = stamp
          test(c)
        }
      }
      if (tx < tz) {
        tEnter = tx
        tx += tdx
        ix += stepX
      } else {
        tEnter = tz
        tz += tdz
        iz += stepZ
      }
      if (!Number.isFinite(tEnter)) break
    }
  }

  /** Colliders qui touchent une sphère ; le rappel renvoie false pour arrêter. */
  intersectionsWithShape(
    pos: Vec,
    _rot: Rot,
    shape: Ball,
    cb: (c: Collider) => boolean,
    _flags?: number,
    groups: number = ALL_GROUPS,
  ) {
    const r = shape.radius
    let go = true
    const test = (c: Collider) => {
      if (!go || !this.accepts(c, groups)) return
      if (sphereOverlaps(c, pos, r)) go = cb(c) !== false
    }
    for (const c of this.heightfields) test(c)
    for (const c of this.dynamicColliders) test(c)
    this.grid.forEachIn(pos.x - r, pos.z - r, pos.x + r, pos.z + r, this.nextStamp(), test)
  }

  /** Colliders fixes et mobiles proches d'un point (contrôleur de personnage). */
  collidersNear(x: number, z: number, radius: number, cb: (c: Collider) => void) {
    for (const c of this.dynamicColliders) {
      if (!c.body.enabled) continue
      const p = c.position()
      const r = c.boundingRadius() + radius
      if (Math.abs(p.x - x) <= r && Math.abs(p.z - z) <= r) cb(c)
    }
    this.grid.forEachIn(x - radius, z - radius, x + radius, z + radius, this.nextStamp(), (c) => {
      if (
        c.aabb.maxX >= x - radius &&
        c.aabb.minX <= x + radius &&
        c.aabb.maxZ >= z - radius &&
        c.aabb.minZ <= z + radius
      )
        cb(c)
    })
  }

  /** Hauteur du terrain sous un point, ou −Infinity sans terrain (grille bilinéaire comme Terrain.heightAt). */
  terrainHeight(x: number, z: number, groups: number = ALL_GROUPS): number {
    let h = -Infinity
    for (const c of this.heightfields) if (this.accepts(c, groups)) h = Math.max(h, heightfieldAt(c, x, z))
    return h
  }

  createVehicleController(body: RigidBody) {
    return new VehicleController(this, body)
  }

  removeVehicleController(vc: VehicleController) {
    void vc
  }

  createCharacterController(offset: number) {
    return new CharacterController(this, offset)
  }

  removeCharacterController(cc: CharacterController) {
    void cc
  }

  free() {
    for (const b of [...this.bodies]) this.removeRigidBody(b)
    this.colliders.clear()
    this.shapeOwner.clear()
  }
}

/** Distance signée le long de la normale d'un contact : négative quand les formes s'interpénètrent. */
function penetration(eq: ContactEquation): number {
  const { bi, bj, ri, rj, ni } = eq
  return (
    (bj.position.x + rj.x - bi.position.x - ri.x) * ni.x +
    (bj.position.y + rj.y - bi.position.y - ri.y) * ni.y +
    (bj.position.z + rj.z - bi.position.z - ri.z) * ni.z
  )
}

// ---------------------------------------------------------------------------------------------
// Géométrie des requêtes

/** Passe un point du monde dans le repère local d'un collider. */
function toLocal(c: Collider, p: Vec): Vec {
  const pos = c.position()
  const inv = quatConj(c.rotation())
  return quatRotate(inv, { x: p.x - pos.x, y: p.y - pos.y, z: p.z - pos.z }, { x: 0, y: 0, z: 0 })
}

function heightfieldAt(c: Collider, x: number, z: number): number {
  const g = c.geometry
  if (g.kind !== 'heightfield') return -Infinity
  const pos = c.position()
  const half = g.size / 2
  const res = g.size / g.n
  const fx = Math.min(g.n - 1e-6, Math.max(0, (x - pos.x + half) / res))
  const fz = Math.min(g.n - 1e-6, Math.max(0, (z - pos.z + half) / res))
  const ix = Math.floor(fx)
  const iz = Math.floor(fz)
  const tx = fx - ix
  const tz = fz - iz
  const N = g.n + 1
  const h = g.heights
  const a = h[ix * N + iz] + (h[(ix + 1) * N + iz] - h[ix * N + iz]) * tx
  const b = h[ix * N + iz + 1] + (h[(ix + 1) * N + iz + 1] - h[ix * N + iz + 1]) * tx
  return pos.y + a + (b - a) * tz
}

function rayCollider(c: Collider, o: Vec, d: Vec, maxT: number, solid: boolean): { t: number; n: Vec } | null {
  const g = c.geometry
  if (g.kind === 'heightfield') return rayHeightfield(c, o, d, maxT)
  const lo = toLocal(c, o)
  const rot = c.rotation()
  const ld = quatRotate(quatConj(rot), d, { x: 0, y: 0, z: 0 })
  let hit: { t: number; n: Vec } | null
  if (g.kind === 'cuboid') hit = rayBox(lo, ld, g.hx, g.hy, g.hz, solid)
  else if (g.kind === 'ball') hit = raySphere(lo, ld, { x: 0, y: 0, z: 0 }, g.r, solid)
  else hit = rayCapsule(lo, ld, g.half, g.r, solid)
  if (!hit || hit.t > maxT) return null
  return { t: hit.t, n: quatRotate(rot, hit.n, { x: 0, y: 0, z: 0 }) }
}

function rayBox(o: Vec, d: Vec, hx: number, hy: number, hz: number, solid: boolean): { t: number; n: Vec } | null {
  let tmin = -Infinity
  let tmax = Infinity
  let n: Vec = { x: 0, y: 0, z: 0 }
  const axes: [keyof Vec, number][] = [
    ['x', hx],
    ['y', hy],
    ['z', hz],
  ]
  for (const [k, h] of axes) {
    const ok = o[k]
    const dk = d[k]
    if (Math.abs(dk) < 1e-12) {
      if (ok < -h || ok > h) return null
      continue
    }
    let t1 = (-h - ok) / dk
    let t2 = (h - ok) / dk
    let sign = -1
    if (t1 > t2) {
      ;[t1, t2] = [t2, t1]
      sign = 1
    }
    if (t1 > tmin) {
      tmin = t1
      n = { x: 0, y: 0, z: 0 }
      n[k] = sign
    }
    tmax = Math.min(tmax, t2)
    if (tmin > tmax) return null
  }
  if (tmax < 0) return null
  if (tmin < 0) return solid ? { t: 0, n: { x: 0, y: 0, z: 0 } } : { t: tmax, n }
  return { t: tmin, n }
}

function raySphere(o: Vec, d: Vec, c: Vec, r: number, solid: boolean): { t: number; n: Vec } | null {
  const ox = o.x - c.x
  const oy = o.y - c.y
  const oz = o.z - c.z
  const b = ox * d.x + oy * d.y + oz * d.z
  const cc = ox * ox + oy * oy + oz * oz - r * r
  if (cc <= 0) return solid ? { t: 0, n: { x: 0, y: 0, z: 0 } } : null
  const disc = b * b - cc
  if (disc < 0 || b > 0) return null
  const t = -b - Math.sqrt(disc)
  const p = { x: ox + d.x * t, y: oy + d.y * t, z: oz + d.z * t }
  return { t, n: { x: p.x / r, y: p.y / r, z: p.z / r } }
}

/** Capsule d'axe Y local, de demi-hauteur `half` (sans les calottes). */
function rayCapsule(o: Vec, d: Vec, half: number, r: number, solid: boolean): { t: number; n: Vec } | null {
  let best: { t: number; n: Vec } | null = null
  // Cylindre infini d'axe Y, limité à |y| ≤ half.
  const a = d.x * d.x + d.z * d.z
  if (a > 1e-12) {
    const b = o.x * d.x + o.z * d.z
    const c = o.x * o.x + o.z * o.z - r * r
    const disc = b * b - a * c
    if (disc >= 0) {
      const t = (-b - Math.sqrt(disc)) / a
      const y = o.y + d.y * t
      if (t >= 0 && Math.abs(y) <= half) {
        const px = o.x + d.x * t
        const pz = o.z + d.z * t
        best = { t, n: { x: px / r, y: 0, z: pz / r } }
      } else if (c <= 0 && Math.abs(o.y) <= half && solid) return { t: 0, n: { x: 0, y: 0, z: 0 } }
    }
  }
  for (const cy of [-half, half]) {
    const hit = raySphere(o, d, { x: 0, y: cy, z: 0 }, r, solid)
    if (hit && (!best || hit.t < best.t)) best = hit
  }
  return best
}

function rayHeightfield(c: Collider, o: Vec, d: Vec, maxT: number): { t: number; n: Vec } | null {
  const g = c.geometry
  if (g.kind !== 'heightfield') return null
  const res = g.size / g.n
  const step = res / 2
  const above = (t: number) => o.y + d.y * t - heightfieldAt(c, o.x + d.x * t, o.z + d.z * t)
  let prevT = 0
  if (above(0) <= 0) return null
  const horiz = Math.hypot(d.x, d.z)
  // Un rayon presque vertical n'a besoin que de quelques échantillons.
  const dt = horiz < 1e-3 ? maxT : Math.min(maxT, step / horiz)
  for (let t = dt; t <= maxT + dt; t += dt) {
    const tt = Math.min(t, maxT)
    const cur = above(tt)
    if (cur <= 0) {
      // Dichotomie entre prevT et tt.
      let lo = prevT
      let hi = tt
      for (let i = 0; i < 12; i++) {
        const mid = (lo + hi) / 2
        if (above(mid) > 0) lo = mid
        else hi = mid
      }
      const x = o.x + d.x * hi
      const z = o.z + d.z * hi
      const e = res * 0.5
      const nx = heightfieldAt(c, x - e, z) - heightfieldAt(c, x + e, z)
      const nz = heightfieldAt(c, x, z - e) - heightfieldAt(c, x, z + e)
      const len = Math.hypot(nx, 2 * e, nz)
      return { t: hi, n: { x: nx / len, y: (2 * e) / len, z: nz / len } }
    }
    prevT = tt
    if (tt >= maxT) break
  }
  return null
}

function sphereOverlaps(c: Collider, p: Vec, r: number): boolean {
  const g = c.geometry
  if (g.kind === 'heightfield') return p.y - r <= heightfieldAt(c, p.x, p.z)
  const l = toLocal(c, p)
  if (g.kind === 'cuboid') {
    const dx = Math.max(Math.abs(l.x) - g.hx, 0)
    const dy = Math.max(Math.abs(l.y) - g.hy, 0)
    const dz = Math.max(Math.abs(l.z) - g.hz, 0)
    return dx * dx + dy * dy + dz * dz <= r * r
  }
  if (g.kind === 'ball') return Math.hypot(l.x, l.y, l.z) <= r + g.r
  const y = Math.max(-g.half, Math.min(g.half, l.y))
  return Math.hypot(l.x, l.y - y, l.z) <= r + g.r
}

// ---------------------------------------------------------------------------------------------
// Contrôleur de véhicule (port du raycast vehicle de Bullet, comme celui de Rapier)

interface Wheel {
  conn: Vec
  dir: Vec
  axle: Vec
  rest: number
  radius: number
  stiffness: number
  compression: number
  relaxation: number
  maxTravel: number
  maxForce: number
  frictionSlip: number
  sideStiffness: number
  steering: number
  engine: number
  brake: number
  inContact: boolean
  length: number
  point: Vec
  normal: Vec
  ground: RigidBody | null
  force: number
  clippedInv: number
  relVel: number
  axleWS: Vec
  forwardWS: Vec
  sideImpulse: number
  forwardImpulse: number
}

export class VehicleController {
  indexUpAxis = 1
  setIndexForwardAxis = 2
  private wheels: Wheel[] = []

  constructor(
    private readonly world: World,
    private readonly body: RigidBody,
  ) {}

  addWheel(conn: Vec, dir: Vec, axle: Vec, rest: number, radius: number) {
    this.wheels.push({
      conn: { ...conn },
      dir: { ...dir },
      axle: { ...axle },
      rest,
      radius,
      stiffness: 5.88,
      compression: 0.83,
      relaxation: 0.88,
      maxTravel: 5,
      maxForce: 6000,
      frictionSlip: 10.5,
      sideStiffness: 1,
      steering: 0,
      engine: 0,
      brake: 0,
      inContact: false,
      length: rest,
      point: { x: 0, y: 0, z: 0 },
      normal: { x: 0, y: 1, z: 0 },
      ground: null,
      force: 0,
      clippedInv: 1,
      relVel: 0,
      axleWS: { x: -1, y: 0, z: 0 },
      forwardWS: { x: 0, y: 0, z: 1 },
      sideImpulse: 0,
      forwardImpulse: 0,
    })
  }

  numWheels() {
    return this.wheels.length
  }
  setWheelSuspensionStiffness(i: number, v: number) {
    this.wheels[i].stiffness = v
  }
  setWheelSuspensionCompression(i: number, v: number) {
    this.wheels[i].compression = v
  }
  setWheelSuspensionRelaxation(i: number, v: number) {
    this.wheels[i].relaxation = v
  }
  setWheelMaxSuspensionTravel(i: number, v: number) {
    this.wheels[i].maxTravel = v
  }
  setWheelMaxSuspensionForce(i: number, v: number) {
    this.wheels[i].maxForce = v
  }
  setWheelFrictionSlip(i: number, v: number) {
    this.wheels[i].frictionSlip = v
  }
  setWheelSideFrictionStiffness(i: number, v: number) {
    this.wheels[i].sideStiffness = v
  }
  setWheelEngineForce(i: number, v: number) {
    this.wheels[i].engine = v
  }
  setWheelSteering(i: number, v: number) {
    this.wheels[i].steering = v
  }
  setWheelBrake(i: number, v: number) {
    this.wheels[i].brake = v
  }
  wheelSteering(i: number): number | null {
    return this.wheels[i]?.steering ?? null
  }
  wheelSuspensionLength(i: number): number | null {
    return this.wheels[i]?.length ?? null
  }
  wheelIsInContact(i: number): boolean {
    return this.wheels[i]?.inContact ?? false
  }

  updateVehicle(dt: number, _flags?: number, groups: number = ALL_GROUPS, predicate?: Predicate) {
    const body = this.body
    if (!body.cbody || !body.isDynamic()) return
    const rot = body.rotation()
    const origin = body.translation()
    const mass = body.mass()

    // Suspension
    for (const w of this.wheels) {
      const hard = quatRotate(rot, w.conn, { x: 0, y: 0, z: 0 })
      hard.x += origin.x
      hard.y += origin.y
      hard.z += origin.z
      const dir = quatRotate(rot, w.dir, { x: 0, y: 0, z: 0 })
      // Braquage : rotation de l'essieu autour de l'axe « haut » de la roue (−direction).
      const up = { x: -dir.x, y: -dir.y, z: -dir.z }
      const axleBody = quatRotate(rot, w.axle, { x: 0, y: 0, z: 0 })
      const s = Math.sin(w.steering / 2)
      w.axleWS = quatRotate({ x: up.x * s, y: up.y * s, z: up.z * s, w: Math.cos(w.steering / 2) }, axleBody, {
        x: 0,
        y: 0,
        z: 0,
      })
      const hit = this.world.castRayAndGetNormal(
        { origin: hard, dir },
        w.rest + w.radius,
        true,
        undefined,
        groups,
        undefined,
        body,
        predicate,
      )
      if (hit && hit.timeOfImpact > 0) {
        w.inContact = true
        w.ground = hit.collider.body.isDynamic() ? hit.collider.body : null
        w.normal = hit.normal
        w.point = {
          x: hard.x + dir.x * hit.timeOfImpact,
          y: hard.y + dir.y * hit.timeOfImpact,
          z: hard.z + dir.z * hit.timeOfImpact,
        }
        w.length = Math.min(w.rest + w.maxTravel, Math.max(w.rest - w.maxTravel, hit.timeOfImpact - w.radius))
        const denom = dot(w.normal, dir)
        const v = body.velocityAt(w.point)
        const proj = dot(w.normal, v)
        if (denom >= -0.1) {
          w.relVel = 0
          w.clippedInv = 10
        } else {
          const inv = -1 / denom
          w.relVel = proj * inv
          w.clippedInv = inv
        }
        let force = w.stiffness * (w.rest - w.length) * w.clippedInv
        force -= (w.relVel < 0 ? w.compression : w.relaxation) * w.relVel
        w.force = Math.max(0, force * mass)
      } else {
        w.inContact = false
        w.ground = null
        w.length = w.rest
        w.relVel = 0
        w.clippedInv = 1
        w.force = 0
      }
    }
    for (const w of this.wheels) {
      if (!w.inContact) continue
      const f = Math.min(w.force, w.maxForce) * dt
      body.applyImpulseAtPoint({ x: w.normal.x * f, y: w.normal.y * f, z: w.normal.z * f }, w.point, false)
    }

    // Frottements
    let sliding = false
    const skid: number[] = []
    for (const w of this.wheels) {
      w.sideImpulse = 0
      w.forwardImpulse = 0
      skid.push(1)
      if (!w.inContact) continue
      const n = w.normal
      const a = w.axleWS
      const p = dot(a, n)
      let ax = { x: a.x - n.x * p, y: a.y - n.y * p, z: a.z - n.z * p }
      const al = Math.hypot(ax.x, ax.y, ax.z) || 1
      ax = { x: ax.x / al, y: ax.y / al, z: ax.z / al }
      w.axleWS = ax
      const fwd = cross(n, ax)
      const fl = Math.hypot(fwd.x, fwd.y, fwd.z) || 1
      w.forwardWS = { x: fwd.x / fl, y: fwd.y / fl, z: fwd.z / fl }
      w.sideImpulse = this.bilateral(w.point, ax, w.ground) * w.sideStiffness
    }
    for (let i = 0; i < this.wheels.length; i++) {
      const w = this.wheels[i]
      if (!w.inContact) continue
      let rolling: number
      if (w.engine !== 0) rolling = w.engine * dt
      else rolling = this.rollingFriction(w.point, w.forwardWS, w.ground, w.brake)
      w.forwardImpulse = rolling
      const maxImp = w.force * dt * w.frictionSlip
      const x = rolling * 0.5
      const y = w.sideImpulse
      const sq = x * x + y * y
      if (sq > maxImp * maxImp) {
        sliding = true
        skid[i] = maxImp / Math.sqrt(sq)
      }
    }
    if (sliding) {
      for (let i = 0; i < this.wheels.length; i++) {
        const w = this.wheels[i]
        if (w.sideImpulse !== 0 && skid[i] < 1) {
          w.forwardImpulse *= skid[i]
          w.sideImpulse *= skid[i]
        }
      }
    }
    for (const w of this.wheels) {
      if (!w.inContact) continue
      if (w.forwardImpulse !== 0) {
        const f = w.forwardWS
        body.applyImpulseAtPoint(
          { x: f.x * w.forwardImpulse, y: f.y * w.forwardImpulse, z: f.z * w.forwardImpulse },
          w.point,
          false,
        )
      }
      if (w.sideImpulse !== 0) {
        const a = w.axleWS
        const imp = { x: a.x * w.sideImpulse, y: a.y * w.sideImpulse, z: a.z * w.sideImpulse }
        body.applyImpulseAtPoint(imp, w.point, false)
        w.ground?.applyImpulseAtPoint({ x: -imp.x, y: -imp.y, z: -imp.z }, w.point, true)
      }
    }
    if (this.wheels.some((w) => w.inContact)) body.wakeUp()
  }

  /** Impulsion qui annule (en partie) la vitesse relative le long de n (resolveSingleBilateral de Bullet). */
  private bilateral(p: Vec, n: Vec, ground: RigidBody | null): number {
    const body = this.body
    const v1 = body.velocityAt(p)
    const v2 = ground ? ground.velocityAt(p) : { x: 0, y: 0, z: 0 }
    const rel = dot(n, { x: v1.x - v2.x, y: v1.y - v2.y, z: v1.z - v2.z })
    const denom = body.impulseDenominator(p, n) + (ground ? ground.impulseDenominator(p, n) : 0)
    if (denom <= 1e-12) return 0
    return (-0.2 * rel) / denom
  }

  private rollingFriction(p: Vec, fwd: Vec, ground: RigidBody | null, maxImpulse: number): number {
    const body = this.body
    const v1 = body.velocityAt(p)
    const v2 = ground ? ground.velocityAt(p) : { x: 0, y: 0, z: 0 }
    const vrel = dot(fwd, { x: v1.x - v2.x, y: v1.y - v2.y, z: v1.z - v2.z })
    const denom = body.impulseDenominator(p, fwd) + (ground ? ground.impulseDenominator(p, fwd) : 0)
    if (denom <= 1e-12) return 0
    const j = -vrel / denom
    return Math.max(-maxImpulse, Math.min(maxImpulse, j))
  }
}

// ---------------------------------------------------------------------------------------------
// Contrôleur de personnage 2,5D

export class CharacterController {
  private autostepHeight = 0
  private snapDistance = 0
  private movement: Vec = { x: 0, y: 0, z: 0 }
  private grounded = false

  constructor(
    private readonly world: World,
    readonly offset: number,
  ) {}

  // Réglages de Rapier sans équivalent ici : le glissement est toujours actif.
  setSlideEnabled(v: boolean) {
    void v
  }
  enableAutostep(maxHeight: number, minWidth: number, dynamic: boolean) {
    void minWidth
    void dynamic
    this.autostepHeight = maxHeight
  }
  enableSnapToGround(distance: number) {
    this.snapDistance = distance
  }
  setMaxSlopeClimbAngle(a: number) {
    void a
  }
  setMinSlopeSlideAngle(a: number) {
    void a
  }
  setApplyImpulsesToDynamicBodies(v: boolean) {
    void v
  }
  setCharacterMass(m: number) {
    void m
  }

  computedMovement(): Vec {
    return this.movement
  }
  computedGrounded(): boolean {
    return this.grounded
  }

  /**
   * Déplace une capsule verticale : le mouvement horizontal glisse le long des obstacles (cercle contre
   * rectangles orientés et autres capsules), puis la hauteur suit le sol (terrain ou dessus des boîtes
   * franchissables), avec marche automatique et accroche au sol.
   */
  computeColliderMovement(
    collider: Collider,
    desired: Vec,
    _flags?: number,
    groups: number = ALL_GROUPS,
    predicate?: Predicate,
  ) {
    const g = collider.geometry
    if (g.kind !== 'capsule') {
      this.movement = { ...desired }
      return
    }
    const world = this.world
    const center = collider.position()
    const r = g.r + this.offset
    const halfH = g.half + g.r
    const feet = center.y - halfH
    const top = center.y + halfH
    const self = collider.body
    let px = center.x + desired.x
    let pz = center.z + desired.z
    const step = this.grounded ? this.autostepHeight : 0.05
    const filter = (c: Collider) =>
      c !== collider &&
      c.body !== self &&
      c.valid &&
      c.enabled &&
      c.body.enabled &&
      groupsInteract(collider.groups, c.groups) &&
      groupsInteract(groups, c.groups) &&
      (!predicate || predicate(c))

    const obstacles: Collider[] = []
    world.collidersNear(px, pz, r + Math.hypot(desired.x, desired.z) + 1, (c) => {
      if (filter(c) && c.geometry.kind !== 'heightfield') obstacles.push(c)
    })

    // Glissement horizontal
    for (let iter = 0; iter < 4; iter++) {
      let moved = false
      for (const c of obstacles) {
        const span = verticalSpan(c)
        // Un obstacle franchissable (sous les pieds) ou au-dessus de la tête (plafond) ne bloque pas le pas.
        if (span.max <= feet + step + Math.max(0, desired.y) || span.min >= top) continue
        const push = pushOut(c, px, pz, r)
        if (push) {
          px += push.x
          pz += push.z
          moved = true
        }
      }
      if (!moved) break
    }

    // Sol sous les pieds
    let ground = world.terrainHeight(px, pz, groups)
    for (const c of obstacles) {
      const span = verticalSpan(c)
      if (span.max > feet + step) continue
      if (footprintTouches(c, px, pz, r * 0.9)) ground = Math.max(ground, span.max)
    }
    let newFeet = feet + desired.y
    let grounded = false
    if (newFeet <= ground) {
      newFeet = ground
      grounded = true
    } else if (this.grounded && desired.y <= 0 && newFeet - ground <= this.snapDistance) {
      newFeet = ground
      grounded = true
    }
    // Plafond
    if (desired.y > 0) {
      for (const c of obstacles) {
        const span = verticalSpan(c)
        if (span.min >= top - 0.05 && span.min < top + desired.y && footprintTouches(c, px, pz, r * 0.9)) {
          newFeet = Math.min(newFeet, span.min - 2 * halfH)
        }
      }
    }
    this.grounded = grounded
    this.movement = { x: px - center.x, y: newFeet - feet, z: pz - center.z }
  }
}

function verticalSpan(c: Collider): { min: number; max: number } {
  const g = c.geometry
  const p = c.position()
  if (g.kind === 'cuboid') {
    // Boîte quelconque : demi-hauteur projetée sur Y.
    const r = c.rotation()
    const ex = Math.abs(quatRotate(r, { x: g.hx, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }).y)
    const ey = Math.abs(quatRotate(r, { x: 0, y: g.hy, z: 0 }, { x: 0, y: 0, z: 0 }).y)
    const ez = Math.abs(quatRotate(r, { x: 0, y: 0, z: g.hz }, { x: 0, y: 0, z: 0 }).y)
    const h = ex + ey + ez
    return { min: p.y - h, max: p.y + h }
  }
  if (g.kind === 'ball') return { min: p.y - g.r, max: p.y + g.r }
  if (g.kind === 'capsule') return { min: p.y - g.half - g.r, max: p.y + g.half + g.r }
  return { min: -Infinity, max: Infinity }
}

/** Cap (rotation autour de Y) d'un collider, pour le traiter comme un rectangle au sol. */
function yawOf(c: Collider): { cos: number; sin: number } {
  const f = quatRotate(c.rotation(), { x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 0 })
  const l = Math.hypot(f.x, f.z) || 1
  return { cos: f.z / l, sin: f.x / l }
}

/** Vecteur qui sort le cercle (px, pz, r) de l'empreinte au sol du collider, ou null. */
function pushOut(c: Collider, px: number, pz: number, r: number): { x: number; z: number } | null {
  const g = c.geometry
  const p = c.position()
  if (g.kind === 'ball' || g.kind === 'capsule') {
    const rr = r + g.r
    const dx = px - p.x
    const dz = pz - p.z
    const d = Math.hypot(dx, dz)
    if (d >= rr) return null
    if (d < 1e-6) return { x: rr, z: 0 }
    return { x: (dx / d) * (rr - d), z: (dz / d) * (rr - d) }
  }
  if (g.kind !== 'cuboid') return null
  const { cos, sin } = yawOf(c)
  // Repère local : z le long de l'avant (sin, cos), x vers (cos, −sin).
  const dx = px - p.x
  const dz = pz - p.z
  const lx = dx * cos - dz * sin
  const lz = dx * sin + dz * cos
  const cx = Math.max(-g.hx, Math.min(g.hx, lx))
  const cz = Math.max(-g.hz, Math.min(g.hz, lz))
  let ox = lx - cx
  let oz = lz - cz
  const d = Math.hypot(ox, oz)
  if (d >= r) return null
  let pushX: number
  let pushZ: number
  if (d > 1e-6) {
    pushX = (ox / d) * (r - d)
    pushZ = (oz / d) * (r - d)
  } else {
    // Centre dans le rectangle : sortie par le côté le plus proche.
    const exX = g.hx - Math.abs(lx)
    const exZ = g.hz - Math.abs(lz)
    if (exX < exZ) {
      ox = Math.sign(lx) || 1
      pushX = ox * (exX + r)
      pushZ = 0
    } else {
      oz = Math.sign(lz) || 1
      pushX = 0
      pushZ = oz * (exZ + r)
    }
  }
  return { x: pushX * cos + pushZ * sin, z: -pushX * sin + pushZ * cos }
}

function footprintTouches(c: Collider, px: number, pz: number, r: number): boolean {
  const g = c.geometry
  const p = c.position()
  if (g.kind === 'ball' || g.kind === 'capsule') return Math.hypot(px - p.x, pz - p.z) < r + g.r
  if (g.kind !== 'cuboid') return false
  const { cos, sin } = yawOf(c)
  const dx = px - p.x
  const dz = pz - p.z
  const lx = dx * cos - dz * sin
  const lz = dx * sin + dz * cos
  const ox = lx - Math.max(-g.hx, Math.min(g.hx, lx))
  const oz = lz - Math.max(-g.hz, Math.min(g.hz, lz))
  return ox * ox + oz * oz < r * r
}
