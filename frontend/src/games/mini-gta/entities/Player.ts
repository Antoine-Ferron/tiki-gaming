import { Vector3 } from 'three'
import { input } from '../core/input'
import { clamp, damp, dampAngle } from '../core/math'
import { Groups, Layer, groups } from '../physics/physics'
import { playerLook } from '../procgen/character/characterModel'
import { WATER_LEVEL } from '../world/constants'
import { hashString, Rng } from '../core/rng'
import { createInventory, WEAPONS, type Inventory } from '../systems/weapons'
import { Actor } from './Actor'
import { CharacterBody } from './CharacterBody'
import type { Vehicle } from './Vehicle'
import type { Game } from '../game/Game'

export type PlayerState = 'foot' | 'vehicle' | 'dead' | 'busted'

/** Réaction d'un conducteur qu'on vient sortir de sa voiture. */
export type DriverReaction = 'flee' | 'fight' | 'speedOff'

/** Étapes de l'entrée dans un véhicule : aller à la portière, forcer ou sortir le conducteur, monter. */
export type EntryPhase = 'approach' | 'force' | 'pull' | 'enter'

/** Durées (s) des étapes de l'entrée dans un véhicule. */
/** Vitesses de déplacement à pied (m/s) et accélération au sol (m/s²). */
export const MOVE = { crouch: 2, aim: 3, run: 5.5, sprint: 10, accel: 24 }

export const ENTRY_TIMES = { force: 1.5, pull: 1.2, enter: 0.9, approachMax: 3.5, speedOffDelay: 0.6 }

export interface VehicleEntry {
  vehicle: Vehicle
  phase: EntryPhase
  /** Temps passé dans l'étape en cours. */
  timer: number
  /** Réaction du conducteur, tirée au début d'un car-jacking. */
  reaction: DriverReaction | null
}

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
  /** Entrée en cours dans un véhicule (null sinon). */
  entry: VehicleEntry | null = null
  /** Véhicules verrouillés ou non, tirés une fois par véhicule ; ceux déjà forcés ou conduits sont ouverts. */
  private locks = new WeakMap<Vehicle, boolean>()
  /** Conducteurs qui démarrent en trombe : on garde l'accélérateur enfoncé quelques secondes. */
  private getaways: { vehicle: Vehicle; timer: number }[] = []
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
    this.updateGetaways(dt)
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
    const speed = a.anim.crouch ? MOVE.crouch : this.aiming ? MOVE.aim : this.sprinting ? MOVE.sprint : MOVE.run
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
    const accel = this.body.grounded ? MOVE.accel : 3
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

    if (this.entry) this.updateEntry(dt, busy, fx !== 0 || fz !== 0 || jump)
    else if (!busy && input.wasPressed('KeyF') && this.enterCooldown <= 0) this.beginEnterVehicle()
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

  /** Le véhicule est-il verrouillé ? Tirage stable par véhicule ; vides et garés seulement. */
  isLocked(v: Vehicle): boolean {
    if (v.driver || v.playerDriven || v.persistent || v.isAircraft || v.spec.kind === 'bike' || v.spec.police)
      return false
    let locked = this.locks.get(v)
    if (locked === undefined) {
      const seed = hashString(`${Math.round(v.position.x)}:${Math.round(v.position.z)}:${v.spec.id}`)
      locked = new Rng(seed).chance(0.5)
      this.locks.set(v, locked)
    }
    return locked
  }

  /**
   * Commence à monter dans le véhicule le plus proche (touche F) : le joueur va à la portière, force la
   * serrure ou sort le conducteur, puis monte. Il reste vulnérable et peut annuler en bougeant.
   */
  beginEnterVehicle() {
    const v = this.nearbyVehicle()
    if (!v) return
    let reaction: DriverReaction | null = null
    if (v.driver && v.driver.faction !== 'police' && !v.isAircraft) {
      const r = new Rng(hashString(`${v.spec.id}:${Math.round(this.game.time * 10)}`)).next()
      reaction = r < 0.55 ? 'flee' : r < 0.8 ? 'fight' : 'speedOff'
    }
    this.entry = { vehicle: v, phase: 'approach', timer: 0, reaction }
  }

  /** Abandonne l'entrée en cours (le joueur bouge, le véhicule part ou est détruit). */
  cancelEntry(reason?: string) {
    this.entry = null
    this.enterCooldown = 0.3
    if (reason) this.game.events.emit('notify', { text: reason, kind: 'info' })
  }

  /** Avancement (0..1) de l'étape en cours, pour l'invite. */
  entryProgress(): number {
    const e = this.entry
    if (!e || e.phase === 'approach') return 0
    return Math.min(1, e.timer / ENTRY_TIMES[e.phase])
  }

  private doorPoint(v: Vehicle): Vector3 {
    v.visual.root.updateMatrixWorld(true)
    return v.visual.exit.clone().multiplyScalar(0.75).applyMatrix4(v.visual.root.matrixWorld)
  }

  private updateEntry(dt: number, busy: boolean, moving: boolean) {
    const e = this.entry!
    const v = e.vehicle
    const a = this.actor
    if (busy) return
    if (moving || input.wasPressed('KeyF')) return this.cancelEntry()
    if (v.destroyed || !this.game.vehicles.has(v)) return this.cancelEntry()
    const door = this.doorPoint(v)
    const toDoor = _v.copy(door).sub(a.position).setY(0)
    if (toDoor.length() > 8) return this.cancelEntry()
    e.timer += dt
    if (e.phase === 'approach') {
      // Le conducteur voit arriver le voleur : certains démarrent en trombe.
      if (e.reaction === 'speedOff' && e.timer > ENTRY_TIMES.speedOffDelay) {
        this.speedOff(v)
        return this.cancelEntry('Le conducteur démarre en trombe !')
      }
      const d = toDoor.length()
      if (d > 0.6) {
        toDoor.divideScalar(d)
        this.body.move(toDoor.x * 3.2, toDoor.z * 3.2, false, dt)
        a.heading = dampAngle(a.heading, Math.atan2(toDoor.x, toDoor.z), 12, dt)
        a.anim.speed = 3.2
        if (e.timer > ENTRY_TIMES.approachMax) this.cancelEntry('Impossible d’atteindre la portière')
        return
      }
      e.phase = v.driver ? 'pull' : this.isLocked(v) ? 'force' : 'enter'
      e.timer = 0
    }
    // Face au véhicule, immobile : forcer, sortir le conducteur ou monter.
    this.body.move(0, 0, false, dt)
    a.anim.speed = 0
    a.heading = dampAngle(a.heading, Math.atan2(v.position.x - a.position.x, v.position.z - a.position.z), 12, dt)
    if (e.timer < ENTRY_TIMES[e.phase]) return
    if (e.phase === 'force') {
      this.breakIn(v, door)
      e.phase = 'enter'
      e.timer = 0
      return
    }
    if (e.phase === 'pull') {
      this.game.peds.ejectDriver(v, e.reaction === 'fight' ? 'fight' : 'flee')
      this.finishEntry(v, true)
      return
    }
    this.finishEntry(v, false)
  }

  /** Vitre brisée : bris de verre, alarme qui alerte les passants, vol signalé à la police s'il y a des témoins. */
  private breakIn(v: Vehicle, door: Vector3) {
    this.locks.set(v, false)
    const glass = door.clone().setY(door.y + 1.1)
    this.game.effects.impact(glass, new Vector3(0, 1, 0), 'spark')
    this.game.events.emit('noise', { x: glass.x, y: glass.y, z: glass.z, radius: 40, source: this.actor })
    this.game.events.emit('notify', { text: 'Alarme !', kind: 'info' })
    this.game.police.crime('vehicleAttack', v.position.x, v.position.z)
  }

  /** Le conducteur garde le pied au plancher quelques secondes, puis lâche l'accélérateur. */
  private speedOff(v: Vehicle) {
    v.makeDynamic()
    v.driverAI = null
    this.getaways.push({ vehicle: v, timer: 4 })
  }

  private updateGetaways(dt: number) {
    for (const g of this.getaways) {
      g.timer -= dt
      const v = g.vehicle
      const go = g.timer > 0 && !!v.driver && v.driver !== this.actor && !v.destroyed
      v.control.throttle = go ? 1 : 0
      v.control.steer = 0
      v.control.handbrake = false
    }
    this.getaways = this.getaways.filter((g) => g.timer > 0 && g.vehicle.driver !== this.actor)
  }

  /** Monte immédiatement dans le véhicule le plus proche (scripts, missions, tests). */
  tryEnterVehicle() {
    const v = this.nearbyVehicle()
    if (!v) return
    let jacked = false
    if (v.driver) {
      // Car-jacking: throw the driver out.
      jacked = true
      this.game.peds.ejectDriver(v)
    }
    this.finishEntry(v, jacked)
  }

  /** Installe le joueur au volant (le conducteur éventuel est déjà sorti). */
  private finishEntry(v: Vehicle, jacked: boolean) {
    this.entry = null
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
