import {
  type CharacterController,
  type Collider,
  ColliderDesc,
  Groups,
  type Physics,
  type RigidBody,
  RigidBodyDesc,
} from '../physics/physics'

export const CAPSULE_RADIUS = 0.32
export const CAPSULE_HALF = 0.58
/** Distance from feet to capsule center. */
export const CAPSULE_CENTER = CAPSULE_HALF + CAPSULE_RADIUS

/** Kinematic capsule driven by Rapier's character controller (player, cops, guards). */
export class CharacterBody {
  readonly body: RigidBody
  readonly collider: Collider
  private controller: CharacterController
  vy = 0
  grounded = false
  private next = { x: 0, y: 0, z: 0 }

  constructor(
    private physics: Physics,
    x: number,
    y: number,
    z: number,
    group: number,
    applyImpulses = true,
  ) {
    const w = physics.world
    this.body = w.createRigidBody(RigidBodyDesc.kinematicPositionBased().setTranslation(x, y + CAPSULE_CENTER, z))
    this.collider = w.createCollider(
      ColliderDesc.capsule(CAPSULE_HALF, CAPSULE_RADIUS).setCollisionGroups(group),
      this.body,
    )
    this.controller = w.createCharacterController(0.03)
    this.controller.setSlideEnabled(true)
    this.controller.enableAutostep(0.45, 0.2, false)
    this.controller.enableSnapToGround(0.4)
    this.controller.setMaxSlopeClimbAngle((50 * Math.PI) / 180)
    this.controller.setMinSlopeSlideAngle((60 * Math.PI) / 180)
    this.controller.setApplyImpulsesToDynamicBodies(applyImpulses)
    this.controller.setCharacterMass(80)
  }

  /** Feet position. */
  get x() {
    return this.body.translation().x
  }
  get feetY() {
    return this.body.translation().y - CAPSULE_CENTER
  }
  get z() {
    return this.body.translation().z
  }

  move(vx: number, vz: number, jump: boolean, dt: number) {
    if (this.grounded && this.vy <= 0) this.vy = jump ? 5.2 : -1
    else this.vy = Math.max(-40, this.vy - 9.81 * 1.6 * dt)
    this.controller.computeColliderMovement(
      this.collider,
      { x: vx * dt, y: this.vy * dt, z: vz * dt },
      undefined,
      Groups.rayAll,
      (c: Collider) => !c.isSensor(),
    )
    const m = this.controller.computedMovement()
    this.grounded = this.controller.computedGrounded()
    if (this.grounded && this.vy > 0 && !jump) this.vy = 0
    const p = this.body.translation()
    this.next.x = p.x + m.x
    this.next.y = p.y + m.y
    this.next.z = p.z + m.z
    this.body.setNextKinematicTranslation(this.next)
  }

  teleport(x: number, y: number, z: number) {
    this.body.setTranslation({ x, y: y + CAPSULE_CENTER, z }, true)
    this.body.setNextKinematicTranslation({ x, y: y + CAPSULE_CENTER, z })
    this.vy = 0
  }

  setEnabled(enabled: boolean) {
    this.collider.setEnabled(enabled)
    this.body.setEnabled(enabled)
  }

  dispose() {
    this.physics.world.removeCharacterController(this.controller)
    this.physics.removeBody(this.body)
  }
}
