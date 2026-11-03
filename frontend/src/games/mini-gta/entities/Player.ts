import { Vector3 } from 'three'
import { input } from '../core/input'
import { clamp, damp, dampAngle } from '../core/math'
import { Groups, Layer, groups } from '../physics/physics'
import { playerLook } from '../procgen/character/characterModel'
import { WATER_LEVEL } from '../world/constants'
import { createInventory, WEAPONS, type Inventory } from '../systems/weapons'
import { Actor } from './Actor'
import { CharacterBody } from './CharacterBody'
import type { Vehicle } from './Vehicle'
import type { Game } from '../game/Game'

export type PlayerState = 'foot' | 'vehicle' | 'dead' | 'busted'

const _v = new Vector3()

export class Player {
  readonly actor: Actor
  readonly body: CharacterBody
  inventory: Inventory = createInventory()
  state: PlayerState = 'foot'
  vehicle: Vehicle | null = null
  aiming = false
  sprinting = false
  stateTimer = 0
  godMode = false
  private moveVx = 0
  private moveVz = 0
  private lastVy = 0
  private enterCooldown = 0
  private drown = 0
  /** Time since last damage (for regen). */
  calm = 0

  constructor(
    private game: Game,
    x: number,
    y: number,
    z: number,
  ) {
    this.actor = new Actor(game, playerLook(), 'player', x, y, z)
    this.actor.maxHealth = 200
    this.actor.health = 200
    this.body = new CharacterBody(game.physics, x, y, z, groups(Layer.Player, 0xffff & ~Layer.Sensor))
    game.physics.setOwner(this.body.collider, { kind: 'character', ref: this.actor })
    this.actor.onDeath = (info) => {
      if (this.godMode) return
      this.state = 'dead'
      this.stateTimer = 0
      game.events.emit('player:died', { cause: info.kind })
    }
    game.events.on('actor:hurt', ({ actor }) => {
      if (actor === this.actor) this.calm = 0
    })
  }

  get position(): Vector3 {
    return this.vehicle ? this.vehicle.position : this.actor.position
  }

  get alive() {
    return this.state === 'foot' || this.state === 'vehicle'
  }

  update(dt: number) {
    this.enterCooldown -= dt
    this.calm += dt
    const a = this.actor
    if (this.godMode) a.health = a.maxHealth
    // Slow regeneration up to half health when out of combat.
    if (this.alive && this.calm > 6 && a.health < a.maxHealth * 0.5)
      a.health = Math.min(a.maxHealth * 0.5, a.health + 4 * dt)

    if (this.state === 'dead' || this.state === 'busted') {
      this.stateTimer += dt
      this.body.move(0, 0, false, dt)
      if (this.stateTimer > 4.5) this.game.respawn(this.state)
      return
    }
    if (this.state === 'vehicle') {
      this.updateVehicle()
      return
    }
    this.updateFoot(dt)
  }

  private updateFoot(dt: number) {
    const a = this.actor
    const cam = this.game.cameraCtl
    const busy = this.game.ui.blocking
    const fx = busy ? 0 : input.axis('KeyA', 'KeyD')
    const fz = busy ? 0 : input.axis('KeyS', 'KeyW')
    this.aiming = !busy && (input.buttons & 2) !== 0
    this.sprinting = input.isDown('ShiftLeft') && !this.aiming
    a.anim.crouch = !busy && input.isDown('KeyC') && this.body.grounded
    const speed = a.anim.crouch ? 1.6 : this.aiming ? 2.4 : this.sprinting ? 6.8 : 3.2
    // Camera-relative movement.
    const yaw = cam.yaw
    const sx = Math.sin(yaw)
    const cz = Math.cos(yaw)
    let dx = sx * fz - cz * fx
    let dz = cz * fz + sx * fx
    const len = Math.hypot(dx, dz)
    if (len > 1) {
      dx /= len
      dz /= len
    }
    const accel = this.body.grounded ? 14 : 3
    this.moveVx = damp(this.moveVx, dx * speed, accel, dt)
    this.moveVz = damp(this.moveVz, dz * speed, accel, dt)
    const jump = !busy && input.wasPressed('Space') && !a.anim.crouch
    const wasGrounded = this.body.grounded
    this.body.move(this.moveVx, this.moveVz, jump, dt)
    if (!wasGrounded && this.body.grounded && this.lastVy < -13) {
      a.damage({ amount: (-this.lastVy - 13) * 9, kind: 'fall' })
    }
    this.lastVy = this.body.vy

    const hs = Math.hypot(this.moveVx, this.moveVz)
    if (this.aiming || this.game.combat.recentlyFired) a.heading = dampAngle(a.heading, yaw, 20, dt)
    else if (hs > 0.3) a.heading = dampAngle(a.heading, Math.atan2(this.moveVx, this.moveVz), 10, dt)
    a.anim.speed = hs
    a.anim.grounded = this.body.grounded
    a.anim.aiming = this.aiming
    a.anim.aimPitch = clamp(-cam.pitch, -1, 1)

    // Water
    if (this.body.feetY < WATER_LEVEL - 1.1) {
      this.drown += dt
      if (this.drown > 3) a.damage({ amount: 40 * dt, kind: 'drown' })
    } else this.drown = 0

    if (!busy && input.wasPressed('KeyF') && this.enterCooldown <= 0) this.tryEnterVehicle()
  }

  private updateVehicle() {
    const v = this.vehicle!
    const c = v.control
    const busy = this.game.ui.blocking
    const ax = (n: string, p: string) => (busy ? 0 : input.axis(n, p))
    if (v.spec.kind === 'heli') {
      c.pitch = ax('KeyS', 'KeyW')
      c.yaw = ax('KeyA', 'KeyD')
      c.roll = ax('KeyQ', 'KeyE')
      c.lift = (input.isDown('ShiftLeft') ? 1 : 0) - (input.isDown('ControlLeft') || input.isDown('Space') ? 1 : 0)
    } else if (v.spec.kind === 'plane') {
      c.pitch = ax('KeyS', 'KeyW')
      c.roll = ax('KeyA', 'KeyD')
      c.yaw = ax('KeyQ', 'KeyE')
      c.lift = (input.isDown('ShiftLeft') ? 1 : 0) - (input.isDown('ControlLeft') ? 1 : 0)
      c.handbrake = !busy && input.isDown('Space')
    } else {
      c.throttle = ax('KeyS', 'KeyW')
      c.steer = ax('KeyA', 'KeyD')
      c.handbrake = !busy && input.isDown('Space')
      if (v.spec.police && !busy && input.wasPressed('KeyH')) v.sirenOn = !v.sirenOn
    }
    this.aiming = !busy && (input.buttons & 2) !== 0 && !v.isAircraft
    if (v.destroyed && this.actor.health > 0 && v.burnTimer < 0) this.exitVehicle(true)
    if (!busy && input.wasPressed('KeyF') && this.enterCooldown <= 0) this.exitVehicle(false)
  }

  /** Find the closest enterable vehicle. */
  nearbyVehicle(): Vehicle | null {
    const p = this.actor.position
    let best: Vehicle | null = null
    let bestD = Infinity
    for (const v of this.game.vehicles) {
      if (v.destroyed) continue
      const d = _v.copy(v.position).sub(p).setY(0).length() - v.spec.length * 0.4
      if (d < 2.6 && d < bestD && Math.abs(v.position.y - p.y) < 3) {
        bestD = d
        best = v
      }
    }
    return best
  }

  tryEnterVehicle() {
    const v = this.nearbyVehicle()
    if (!v) return
    let jacked = false
    if (v.driver) {
      // Car-jacking: throw the driver out.
      jacked = true
      this.game.peds.ejectDriver(v)
    }
    for (const p of v.passengers) this.game.peds.ejectPassenger(v, p)
    v.passengers = []
    v.makeDynamic()
    v.driverAI = null
    v.idle = 0
    this.vehicle = v
    v.driver = this.actor
    v.playerDriven = true
    this.state = 'vehicle'
    this.enterCooldown = 0.6
    this.body.setEnabled(false)
    const a = this.actor
    a.seatedIn = v
    v.visual.tilt.add(a.rig.object)
    a.rig.object.position.copy(v.visual.seat)
    a.rig.object.rotation.set(0, 0, 0)
    a.anim.seated = true
    a.anim.speed = 0
    if (v.spec.kind === 'heli' || v.spec.kind === 'plane') v.engine = Math.max(v.engine, 0.1)
    this.game.events.emit('vehicle:entered', { vehicle: v, jacked })
  }

  exitVehicle(force: boolean) {
    const v = this.vehicle
    if (!v) return
    if (!force && Math.abs(v.speed) > 8 && !v.isAircraft) return
    const a = this.actor
    const root = v.visual.root
    root.updateMatrixWorld(true)
    // Exit on the driver side, or the other side if blocked.
    let exit = v.visual.exit.clone().applyMatrix4(root.matrixWorld)
    const center = v.position.clone().setY(v.position.y + 1)
    const blocked = (p: Vector3) => {
      const d = p.clone().setY(center.y).sub(center)
      const len = d.length()
      return !!this.game.physics.raycast(
        center.x,
        center.y,
        center.z,
        d.x / len,
        0,
        d.z / len,
        len + 0.4,
        groups(0xffff, Layer.Static | Layer.Vehicle),
        v.body,
      )
    }
    if (blocked(exit)) {
      const other = v.visual.exit.clone().setX(-v.visual.exit.x).applyMatrix4(root.matrixWorld)
      if (!blocked(other)) exit = other
      else exit = v.position.clone().setY(v.position.y + 2.5)
    }
    const ground = this.game.physics.raycast(exit.x, exit.y + 2, exit.z, 0, -1, 0, 20, Groups.rayWorld)
    const y = ground ? ground.y : exit.y
    v.driver = null
    v.playerDriven = false
    v.control.throttle = 0
    v.control.steer = 0
    this.vehicle = null
    this.state = this.actor.dead ? 'dead' : 'foot'
    this.enterCooldown = 0.6
    a.seatedIn = null
    a.anim.seated = false
    this.game.root.add(a.rig.object)
    this.body.setEnabled(true)
    this.body.teleport(exit.x, y + 0.05, exit.z)
    a.interp.snap({ x: exit.x, y, z: exit.z })
    a.heading = v.heading()
    this.moveVx = this.moveVz = 0
    this.game.events.emit('vehicle:exited', { vehicle: v })
    if (force && Math.abs(v.speed) > 12) a.damage({ amount: Math.abs(v.speed) * 2, kind: 'fall' })
  }

  postStep() {
    if (this.state === 'vehicle' && this.vehicle) {
      const p = this.vehicle.body.translation()
      this.actor.pushPosition(p.x, p.y, p.z)
      return
    }
    this.actor.pushPosition(this.body.x, this.body.feetY, this.body.z)
  }

  respawnAt(x: number, y: number, z: number) {
    if (this.vehicle) this.exitVehicle(true)
    const a = this.actor
    a.health = a.maxHealth
    a.deadTime = 0
    this.state = 'foot'
    this.body.teleport(x, y, z)
    a.interp.snap({ x, y, z })
    this.drown = 0
  }

  currentWeapon() {
    return WEAPONS[this.inventory.current]
  }
}
