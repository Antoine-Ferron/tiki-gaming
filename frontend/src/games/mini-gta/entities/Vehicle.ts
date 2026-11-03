import { BufferAttribute, Color, Quaternion, Vector3, type BufferGeometry } from 'three'
import { clamp, damp } from '../core/math'
import {
  ActiveEvents,
  type Collider,
  ColliderDesc,
  Groups,
  type Physics,
  type RigidBody,
  RigidBodyDesc,
  RigidBodyType,
  type VehicleController,
} from '../physics/physics'
import { VEHICLES, type VehicleSpec } from '../procgen/vehicles/specs'
import { buildVehicle, disposeVehicleVisual, type VehicleVisual } from '../procgen/vehicles/vehicleModel'
import { burntMaterial } from '../render/vehicleMaterials'
import { Interp } from '../game/Interp'
import type { Game } from '../game/Game'
import type { Actor } from './Actor'

export interface VehicleControl {
  throttle: number // -1..1 (cars: W/S)
  steer: number // -1..1 (+ = right)
  handbrake: boolean
  pitch: number
  roll: number
  yaw: number
  lift: number // heli collective / plane throttle delta
}

/** Réglages globaux de la conduite. */
export const DRIVING = {
  /** Adhérence de pointe des pneus (G) = grip du véhicule × ce facteur. */
  gripScale: 0.55,
  engineScale: 1.6,
  /** Force de freinage par roue (N) = brake du véhicule × ce facteur. */
  brakeScale: 60,
  /** Part du freinage sur l'essieu avant. */
  brakeBiasFront: 0.6,
  downforce: 0.35,
  compression: 4.4,
  relaxation: 5.3,
}

/** Réglages de l'hélicoptère (valeurs propres au jeu). */
export const HELI = {
  /** Inclinaison maximale (rad) en tangage et en roulis. */
  maxTilt: 0.7,
  /** Poussée supplémentaire (en part du poids) au collectif à fond. */
  collective: 0.95,
  /** Traînée horizontale linéaire (1/s) et quadratique (1/m) : ~215 km/h nez baissé à fond. */
  linearDrag: 0.06,
  quadDrag: 0.001,
  /** Frein de stationnaire (1/s) quand le manche est lâché. */
  hoverBrake: 0.35,
  verticalDrag: 0.5,
}

/** Réglages de l'avion. */
export const PLANE = {
  /** Poussée à plein gaz (m/s²). */
  thrust: 11,
  /** Coefficient de traînée quadratique (1/m) : vitesse de pointe ≈ √(thrust / drag) ≈ 380 km/h. */
  drag: 0.001,
  /** Vitesse (m/s) où la portance égale le poids. */
  takeoff: 26,
  maxLift: 1.15,
  /** Lacet (rad/s) ailes à la verticale, en virage coordonné. */
  bankTurn: 0.9,
}

/** Rapports de boîte, du premier (couple maximal) au dernier ; la force motrice leur est proportionnelle. */
export const GEARS = [3.33, 2.72, 2.11, 1.51, 0.9]
const GEAR_MEAN = 1.8
/** Durée (s) de la coupure de puissance à chaque passage de rapport. */
const SHIFT_TIME = 0.25

const _v = new Vector3()
const _q = new Quaternion()
const _fwd = new Vector3()
const _up = new Vector3()
const _right = new Vector3()

let nextId = 1

export class Vehicle {
  readonly id = nextId++
  readonly spec: VehicleSpec
  readonly visual: VehicleVisual
  readonly body: RigidBody
  readonly collider: Collider
  private controller?: VehicleController
  readonly interp = new Interp()
  readonly control: VehicleControl = { throttle: 0, steer: 0, handbrake: false, pitch: 0, roll: 0, yaw: 0, lift: 0 }
  mode: 'kinematic' | 'dynamic'
  health: number
  destroyed = false
  burnTimer = -1
  driver: Actor | null = null
  passengers: Actor[] = []
  playerDriven = false
  /** Speed along the forward axis (m/s). */
  speed = 0
  /** Rapport engagé (1 à 5). */
  gear = 1
  private shiftTimer = 0
  /** Owned by the traffic system while set. */
  traffic: unknown = null
  /** Owned by an AI driver (police, missions). */
  driverAI: unknown = null
  tags = new Set<string>()
  sirenOn = false
  /** Seconds since last relevant activity (for despawn). */
  idle = 0
  persistent = false
  private steerSmoothed = 0
  private wheelSpin = 0
  private upsideDown = 0
  private deformed?: BufferGeometry
  private lastVel = new Vector3()
  /** Plane throttle 0..1, heli rotor spool 0..1. */
  engine = 0
  private rotorAngle = 0
  private kinematicSteer = 0

  constructor(
    private game: Game,
    specId: string,
    x: number,
    y: number,
    z: number,
    heading: number,
    mode: 'kinematic' | 'dynamic',
    color?: string,
  ) {
    const spec = VEHICLES[specId]
    this.spec = spec
    this.mode = mode
    this.health = spec.health
    const paint = new Color(color ?? spec.colors[Math.floor(Math.random() * spec.colors.length)])
    this.visual = buildVehicle(spec, paint)
    game.root.add(this.visual.root)

    const physics: Physics = game.physics
    const w = physics.world
    const rot = { x: 0, y: Math.sin(heading / 2), z: 0, w: Math.cos(heading / 2) }
    const desc = (mode === 'kinematic' ? RigidBodyDesc.kinematicPositionBased() : RigidBodyDesc.dynamic())
      .setTranslation(x, y, z)
      .setRotation(rot)
      .setLinearDamping(0) // traînées explicites (voitures, motos, hélico, avion)
      .setAngularDamping(spec.kind === 'car' || spec.kind === 'bike' ? 1.2 : 2.5)
      .setCanSleep(true)
    this.body = w.createRigidBody(desc)

    // Garde au sol de la caisse : au-dessus des trottoirs (15 cm) et des jointures, une fois la suspension tassée.
    const clear = spec.wheelRadius
    let hx = spec.width / 2
    let hy = (spec.belt + spec.cabin.height - clear) / 2 - 0.05
    let hz = spec.length / 2
    let cy = clear + hy + 0.05
    if (spec.kind === 'bike') {
      hx = 0.3
      hy = 0.4
      // Fond de caisse à la hauteur de l'axe des roues : il ne frotte jamais le sol, même à pleine vitesse.
      cy = spec.wheelRadius + 0.45
    } else if (spec.kind === 'heli') {
      hx = 1.1
      hy = 0.85
      hz = 2.2
      cy = 1.6
    } else if (spec.kind === 'plane') {
      hx = 0.6
      hy = 0.5
      hz = 3.6
      cy = 1.6
    }
    this.collider = w.createCollider(
      ColliderDesc.cuboid(hx, hy, hz)
        .setTranslation(0, cy, 0)
        .setMass(spec.mass * 0.5)
        .setFriction(0.4)
        .setRestitution(0.1)
        .setCollisionGroups(Groups.vehicle)
        .setActiveEvents(ActiveEvents.CONTACT_FORCE_EVENTS | ActiveEvents.COLLISION_EVENTS)
        .setContactForceEventThreshold(spec.mass * 9.81 * 6),
      this.body,
    )
    physics.setOwner(this.collider, { kind: 'vehicle', ref: this })
    // Lest bas : il abaisse le centre de gravité (stabilité). Il ne sert qu'à la masse, sans contact :
    // la caisse, plus haute, touche seule le décor.
    const ballast = w.createCollider(
      ColliderDesc.cuboid(hx * 0.8, 0.1, hz * 0.8)
        .setTranslation(0, spec.kind === 'heli' ? 0.3 : spec.wheelRadius * 0.55 + 0.1, 0)
        .setMass(spec.mass * 0.5)
        .setCollisionGroups(Groups.vehicle),
      this.body,
    )
    physics.setOwner(ballast, { kind: 'vehicle', ref: this })
    if (spec.kind !== 'heli') ballast.setEnabled(false)
    if (spec.kind === 'heli') {
      for (const sx of [-0.9, 0.9]) {
        const skid = w.createCollider(
          ColliderDesc.cuboid(0.08, 0.08, 1.6)
            .setTranslation(sx, 0.08, 0.5)
            .setMass(1)
            .setFriction(1)
            .setCollisionGroups(Groups.vehicle),
          this.body,
        )
        physics.setOwner(skid, { kind: 'vehicle', ref: this })
      }
    }
    if (spec.kind === 'plane') {
      const wing = w.createCollider(
        ColliderDesc.cuboid(spec.width / 2, 0.08, 0.75)
          .setTranslation(0, 2.25, 1)
          .setMass(1)
          .setCollisionGroups(Groups.vehicle),
        this.body,
      )
      physics.setOwner(wing, { kind: 'vehicle', ref: this })
    }

    if (spec.kind !== 'heli') this.createController()
    this.interp.snap({ x, y, z }, rot)
    this.visual.root.position.set(x, y, z)
    this.visual.root.quaternion.set(rot.x, rot.y, rot.z, rot.w)
  }

  private createController() {
    const spec = this.spec
    const vc = this.game.physics.world.createVehicleController(this.body)
    vc.indexUpAxis = 1
    vc.setIndexForwardAxis = 2
    const rest = spec.suspension
    const r = spec.wheelRadius
    const conn = (x: number, z: number) => ({ x, y: r + rest * 0.8, z })
    const t = spec.track / 2
    const wheels =
      spec.kind === 'plane'
        ? [conn(0, spec.frontAxle), conn(t, spec.rearAxle), conn(-t, spec.rearAxle)]
        : [conn(t, spec.frontAxle), conn(-t, spec.frontAxle), conn(t, spec.rearAxle), conn(-t, spec.rearAxle)]
    for (const c of wheels) vc.addWheel(c, { x: 0, y: -1, z: 0 }, { x: -1, y: 0, z: 0 }, rest, r)
    for (let i = 0; i < vc.numWheels(); i++) {
      vc.setWheelSuspensionStiffness(i, spec.stiffness)
      vc.setWheelSuspensionCompression(i, DRIVING.compression)
      vc.setWheelSuspensionRelaxation(i, DRIVING.relaxation)
      vc.setWheelMaxSuspensionTravel(i, rest)
      vc.setWheelMaxSuspensionForce(i, spec.mass * 9.81 * 2)
      vc.setWheelFrictionSlip(i, spec.grip * DRIVING.gripScale)
      vc.setWheelSideFrictionStiffness(i, 1)
    }
    this.controller = vc
  }

  get position() {
    return this.interp.curr
  }

  get isAircraft() {
    return this.spec.kind === 'heli' || this.spec.kind === 'plane'
  }

  forward(out: Vector3) {
    const r = this.body.rotation()
    return out.set(0, 0, 1).applyQuaternion(_q.set(r.x, r.y, r.z, r.w))
  }

  heading() {
    this.forward(_fwd)
    return Math.atan2(_fwd.x, _fwd.z)
  }

  /** Kinematic AI pose for the next step. */
  setPose(x: number, y: number, z: number, heading: number, speed: number, steer = 0) {
    this.body.setNextKinematicTranslation({ x, y, z })
    this.body.setNextKinematicRotation({ x: 0, y: Math.sin(heading / 2), z: 0, w: Math.cos(heading / 2) })
    this.speed = speed
    this.kinematicSteer = steer
  }

  makeDynamic() {
    if (this.mode === 'dynamic') return
    this.mode = 'dynamic'
    const v = this.speed
    this.forward(_fwd)
    this.body.setBodyType(RigidBodyType.Dynamic, true)
    this.body.setLinvel({ x: _fwd.x * v, y: 0, z: _fwd.z * v }, true)
    this.traffic = null
  }

  /** Passe les rapports selon la vitesse : chaque rapport couvre une part de la vitesse de pointe. */
  private selectGear() {
    const top = (g: number) => (this.spec.maxSpeed * GEARS[GEARS.length - 1]) / GEARS[g - 1]
    const v = Math.max(0, this.speed)
    let g = this.gear
    if (g < GEARS.length && v > top(g) * 0.97) g++
    else if (g > 1 && v < top(g - 1) * 0.75) g--
    if (g !== this.gear) {
      this.gear = g
      this.shiftTimer = SHIFT_TIME
    }
  }

  /** Apply controls before the physics step. */
  update(dt: number) {
    if (this.mode !== 'dynamic') return
    const spec = this.spec
    const body = this.body
    const lv = body.linvel()
    const r = body.rotation()
    _q.set(r.x, r.y, r.z, r.w)
    _fwd.set(0, 0, 1).applyQuaternion(_q)
    _up.set(0, 1, 0).applyQuaternion(_q)
    _right.set(-1, 0, 0).applyQuaternion(_q)
    this.speed = lv.x * _fwd.x + lv.y * _fwd.y + lv.z * _fwd.z
    const mass = spec.mass
    const c =
      this.destroyed || !this.driver
        ? { ...this.control, throttle: 0, steer: 0, handbrake: true, lift: -1 }
        : this.control

    if (spec.kind === 'heli') {
      this.updateHeli(dt, c, mass)
      return
    }
    const vc = this.controller!
    const n = vc.numWheels()

    if (spec.kind === 'plane') {
      this.updatePlane(dt, c, mass, vc)
      return
    }

    // --- Cars & bikes : boîte de vitesses, traînée et freins ; l'adhérence est celle des pneus (moteur physique).
    const absSpeed = Math.abs(this.speed)
    const steerTarget = -c.steer * spec.steer * (1 / (1 + absSpeed * 0.045))
    this.steerSmoothed = damp(this.steerSmoothed, steerTarget, 8, dt)
    const total = 2 * spec.engine * DRIVING.engineScale
    this.shiftTimer = Math.max(0, this.shiftTimer - dt)
    this.selectGear()
    let drive = 0
    let brake = 0
    if (c.throttle > 0.05) {
      if (this.speed < -1) brake = spec.brake * DRIVING.brakeScale
      else if (this.shiftTimer === 0) drive = (total * GEARS[this.gear - 1] * c.throttle) / GEAR_MEAN
    } else if (c.throttle < -0.05) {
      if (this.speed > 1) brake = spec.brake * DRIVING.brakeScale
      else drive = -total * 0.6 * -c.throttle * (1 - clamp(-this.speed / 12, 0, 1))
    } else {
      // Frein moteur.
      brake = spec.brake * DRIVING.brakeScale * 0.06
    }
    if (!this.driver) brake = spec.brake * DRIVING.brakeScale * 0.5
    const driven = spec.drive === 'awd' ? [0, 1, 2, 3] : spec.drive === 'fwd' ? [0, 1] : [2, 3]
    const grip = spec.grip * DRIVING.gripScale
    for (let i = 0; i < n; i++) {
      const rear = i >= 2
      vc.setWheelEngineForce(i, driven.includes(i) ? drive / driven.length : 0)
      vc.setWheelSteering(i, i < 2 ? this.steerSmoothed : 0)
      // Répartition 60/40 : le freinage charge l'avant.
      const bias = n < 4 ? 1 : rear ? 2 * (1 - DRIVING.brakeBiasFront) : 2 * DRIVING.brakeBiasFront
      vc.setWheelBrake(i, brake * bias + (c.handbrake && rear ? spec.brake * DRIVING.brakeScale * 3 : 0))
      // Frein à main : l'arrière bloqué perd de l'adhérence latérale et décroche (dérapage contrôlé).
      vc.setWheelSideFrictionStiffness(i, c.handbrake && rear ? 0.3 : 1)
      vc.setWheelFrictionSlip(i, grip)
    }
    vc.updateVehicle(dt, undefined, Groups.wheels, (col) => col.parent()?.handle !== body.handle)

    let grounded = 0
    for (let i = 0; i < n; i++) if (vc.wheelIsInContact(i)) grounded++
    // Traînée : elle égale la poussée du dernier rapport à la vitesse de pointe du modèle.
    const drag = ((total * GEARS[GEARS.length - 1]) / GEAR_MEAN / (spec.maxSpeed * spec.maxSpeed)) * dt
    const v2 = lv.x * lv.x + lv.z * lv.z
    if (v2 > 0.01) {
      const v = Math.sqrt(v2)
      body.applyImpulse({ x: -lv.x * v * drag, y: 0, z: -lv.z * v * drag }, true)
    }
    if (grounded > 0) {
      // Appui aérodynamique : charge les pneus (donc l'adhérence) avec la vitesse.
      body.applyImpulse({ x: 0, y: -mass * DRIVING.downforce * absSpeed * dt, z: 0 }, true)
    }
    // Roll stabilisation (strong for bikes), keeps cars from tipping too easily.
    const rollRight = -Math.asin(clamp(_right.y, -1, 1))
    const av = body.angvel()
    const rollRate = av.x * _fwd.x + av.y * _fwd.y + av.z * _fwd.z
    const kr = spec.kind === 'bike' ? 60 : grounded > 0 ? 4 : 0.5
    const inertia = mass * 0.6
    const torque = (-rollRight * kr - rollRate * (spec.kind === 'bike' ? 8 : 1)) * inertia * dt
    body.applyTorqueImpulse({ x: _fwd.x * torque, y: _fwd.y * torque, z: _fwd.z * torque }, true)
    if (spec.kind === 'bike') {
      const pitchUp = Math.asin(clamp(_fwd.y, -1, 1))
      const pitchRate = av.x * _right.x + av.y * _right.y + av.z * _right.z
      const tp = (-pitchUp * (grounded ? 6 : 1) - pitchRate * 2) * inertia * dt
      body.applyTorqueImpulse({ x: _right.x * tp, y: _right.y * tp, z: _right.z * tp }, true)
    }
    // Auto-flip when stuck upside down.
    if (_up.y < 0.3 && absSpeed < 2) this.upsideDown += dt
    else this.upsideDown = 0
    if (this.upsideDown > 2.5 && !this.destroyed) {
      const p = body.translation()
      const h = this.heading()
      body.setTranslation({ x: p.x, y: p.y + 1.5, z: p.z }, true)
      body.setRotation({ x: 0, y: Math.sin(h / 2), z: 0, w: Math.cos(h / 2) }, true)
      body.setLinvel({ x: 0, y: 0, z: 0 }, true)
      body.setAngvel({ x: 0, y: 0, z: 0 }, true)
      this.upsideDown = 0
    }
  }

  private updateHeli(dt: number, c: VehicleControl, mass: number) {
    const body = this.body
    const hasPilot = !!this.driver && !this.destroyed
    this.engine = damp(this.engine, hasPilot ? 1 : 0, hasPilot ? 0.8 : 0.3, dt)
    const g = 9.81
    const collective = hasPilot ? c.lift : -1
    // La poussée compense l'inclinaison : nez baissé, l'hélico garde son altitude et convertit le surplus
    // en vitesse (limité à 1/0,55 du poids pour une inclinaison extrême).
    const tiltComp = 1 / Math.max(_up.y, 0.55)
    const thrust = mass * g * this.engine * (1 + HELI.collective * collective) * (_up.y > 0 ? tiltComp : 0)
    body.applyImpulse({ x: _up.x * thrust * dt, y: _up.y * thrust * dt, z: _up.z * thrust * dt }, true)
    // Attitude: pitch/roll targets with auto-level. Axes: pitch-up about `right`, roll-right about `fwd`, yaw-right about `-up`.
    const pitchUp = Math.asin(clamp(_fwd.y, -1, 1))
    const rollRight = -Math.asin(clamp(_right.y, -1, 1))
    const eff = this.engine
    const wP = (-c.pitch * HELI.maxTilt - pitchUp) * 3 * eff
    const wR = (c.roll * HELI.maxTilt - rollRight) * 3 * eff
    const wY = c.yaw * 1.4 * eff
    this.blendAngvel(wP, wR, wY, eff > 0.3 ? 0.15 : 0.02)
    // Traînée : quadratique (elle fixe la vitesse de croisière), plus un frein de stationnaire quand le
    // pilote lâche le manche, pour qu'il reste facile de s'immobiliser.
    const lv = body.linvel()
    const hv = Math.hypot(lv.x, lv.z)
    const idle = Math.abs(c.pitch) < 0.1 && Math.abs(c.roll) < 0.1 && hasPilot
    const kh = (HELI.linearDrag + (idle ? HELI.hoverBrake : 0) + HELI.quadDrag * hv) * mass * dt
    body.applyImpulse({ x: -lv.x * kh, y: -lv.y * HELI.verticalDrag * mass * dt, z: -lv.z * kh }, true)
    this.rotorAngle += this.engine * 40 * dt
  }

  private updatePlane(dt: number, c: VehicleControl, mass: number, vc: VehicleController) {
    const body = this.body
    const hasPilot = !!this.driver && !this.destroyed
    if (hasPilot) this.engine = clamp(this.engine + c.lift * 0.5 * dt, 0, 1)
    else this.engine = damp(this.engine, 0, 1, dt)
    const lv = body.linvel()
    const v = this.speed
    const thrust = this.engine * mass * PLANE.thrust
    body.applyImpulse({ x: _fwd.x * thrust * dt, y: _fwd.y * thrust * dt, z: _fwd.z * thrust * dt }, true)
    // Portance ∝ v², plafonnée un peu au-dessus du poids : l'avion monte doucement à vitesse de croisière
    // et le pilote règle l'altitude au tangage ; décrochage sous la vitesse de décollage.
    const takeoff = PLANE.takeoff
    // En virage, la portance augmente avec l'inclinaison pour garder l'altitude (facteur de charge).
    const load = 1 / Math.max(Math.abs(_up.y), 0.55)
    const lift = mass * 9.81 * clamp((v / takeoff) ** 2, 0, PLANE.maxLift * load)
    body.applyImpulse({ x: _up.x * lift * dt, y: _up.y * lift * dt, z: _up.z * lift * dt }, true)
    // Drag
    const sp = Math.hypot(lv.x, lv.y, lv.z)
    // Traînée quadratique : elle égale la poussée à la vitesse de pointe.
    const drag = PLANE.drag * sp * mass * dt
    body.applyImpulse({ x: -lv.x * drag, y: -lv.y * drag, z: -lv.z * drag }, true)
    // Align velocity with nose (weathervane), stronger at speed.
    if (sp > 12) {
      const k = clamp((sp - 12) / 30, 0, 1) * 0.03
      const tx = _fwd.x * sp - lv.x
      const ty = _fwd.y * sp - lv.y
      const tz = _fwd.z * sp - lv.z
      body.applyImpulse({ x: tx * k * mass, y: ty * k * mass, z: tz * k * mass }, true)
    }
    // Control surfaces (W = nose down, D = roll right, E = yaw right).
    const eff = clamp(v / takeoff, 0, 1.2)
    // Virage coordonné : les ailes inclinées font tourner l'avion (lacet proportionnel à l'inclinaison).
    const bank = -Math.asin(clamp(_right.y, -1, 1))
    const turn = Math.sin(bank) * PLANE.bankTurn * Math.min(eff, 1)
    if (eff > 0.15) this.blendAngvel(-c.pitch * 1.3 * eff, c.roll * 2.2 * eff, c.yaw * 0.5 * eff + turn, 0.12)
    // Ground: nose wheel steering + brakes
    for (let i = 0; i < vc.numWheels(); i++) {
      vc.setWheelEngineForce(i, 0)
      vc.setWheelSteering(i, i === 0 ? -c.yaw * 0.5 - c.roll * 0.3 : 0)
      vc.setWheelBrake(i, c.handbrake ? mass * 2.5 : 10)
    }
    vc.updateVehicle(dt, undefined, Groups.wheels, (col) => col.parent()?.handle !== body.handle)
    this.rotorAngle += (0.2 + this.engine) * 50 * dt
  }

  /** Blend angular velocity toward a target expressed as pitch-up / roll-right / yaw-right rates. */
  private blendAngvel(pitchUp: number, rollRight: number, yawRight: number, k: number) {
    const av = this.body.angvel()
    const tx = _right.x * pitchUp + _fwd.x * rollRight - _up.x * yawRight
    const ty = _right.y * pitchUp + _fwd.y * rollRight - _up.y * yawRight
    const tz = _right.z * pitchUp + _fwd.z * rollRight - _up.z * yawRight
    this.body.setAngvel({ x: av.x + (tx - av.x) * k, y: av.y + (ty - av.y) * k, z: av.z + (tz - av.z) * k }, true)
  }

  /** After the physics step. */
  postStep(dt: number) {
    const p = this.body.translation()
    const r = this.body.rotation()
    this.interp.push(p, r)
    if (this.mode === 'dynamic') {
      const lv = this.body.linvel()
      // Detect hard impacts from velocity change (used for deformation direction).
      const dvx = lv.x - this.lastVel.x
      const dvy = lv.y - this.lastVel.y
      const dvz = lv.z - this.lastVel.z
      const dv = Math.hypot(dvx, dvy, dvz)
      if (dv > 6 && !this.destroyed) this.deform(-dvx / dv, -dvy / dv, -dvz / dv, Math.min(0.35, dv * 0.02))
      this.lastVel.set(lv.x, lv.y, lv.z)
    }
    if (this.burnTimer >= 0) {
      this.burnTimer -= dt
      if (this.burnTimer < 0) this.explode()
    }
    // Water: sink and die.
    if (p.y < -2 && !this.destroyed && this.spec.kind !== 'plane') this.damage(this.spec.health * dt * 0.5)
  }

  damage(amount: number, from?: Actor | null) {
    if (this.destroyed) return
    const armor = this.spec.armored ? 0.4 : 1
    this.health -= amount * armor
    if (from && from.faction === 'player') this.game.events.emit('vehicle:attacked', { vehicle: this })
    if (this.health <= this.spec.health * 0.12 && this.burnTimer < 0) this.burnTimer = 5
    if (this.health <= -this.spec.health * 0.3) this.explode()
  }

  explode() {
    if (this.destroyed) return
    this.destroyed = true
    this.burnTimer = -1
    this.health = 0
    this.sirenOn = false
    this.visual.paintMesh.material = burntMaterial
    this.visual.lights.uniforms.uHead.value = 0
    this.visual.lights.uniforms.uTail.value = 0
    this.visual.lights.uniforms.uSiren.value = 0
    this.makeDynamic()
    const p = this.body.translation()
    this.body.applyImpulse(
      { x: (Math.random() - 0.5) * 2000, y: this.spec.mass * 6, z: (Math.random() - 0.5) * 2000 },
      true,
    )
    this.body.applyTorqueImpulse({ x: (Math.random() - 0.5) * 3000, y: 0, z: (Math.random() - 0.5) * 3000 }, true)
    this.game.combat.explosion(p.x, p.y + 1, p.z, 9, 160, this.lastAttacker)
    this.game.events.emit('vehicle:destroyed', { vehicle: this })
  }

  lastAttacker: Actor | null = null

  /** Push body vertices inward around the impact point (local space). */
  private deform(dx: number, dy: number, dz: number, depth: number) {
    const mesh = this.visual.paintMesh
    if (!this.deformed) {
      this.deformed = mesh.geometry.clone()
      mesh.geometry = this.deformed
    }
    const inv = _q.copy(this.visual.root.quaternion).invert()
    const dir = _v.set(dx, dy, dz).applyQuaternion(inv).normalize()
    const L = this.spec.length / 2
    const W = this.spec.width / 2
    const center = { x: dir.x * W, y: this.spec.belt * 0.7, z: dir.z * L }
    const pos = this.deformed.getAttribute('position') as BufferAttribute
    const radius = 0.9
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const y = pos.getY(i)
      const z = pos.getZ(i)
      const d = Math.hypot(x - center.x, y - center.y, z - center.z)
      if (d > radius) continue
      const k = (1 - d / radius) * depth
      pos.setXYZ(i, x - dir.x * k, y - Math.abs(dir.y) * k * 0.3, z - dir.z * k)
    }
    pos.needsUpdate = true
    this.deformed.computeVertexNormals()
  }

  render(alpha: number, dt: number, night: number) {
    const v = this.visual
    this.interp.apply(v.root, alpha)
    // Wheels
    const vc = this.controller
    if (this.spec.kind === 'car' || this.spec.kind === 'bike' || this.spec.kind === 'plane') {
      this.wheelSpin += (this.speed / this.spec.wheelRadius) * dt
      for (let i = 0; i < v.wheels.length; i++) {
        const w = v.wheels[i]
        let steer = this.mode === 'kinematic' ? -this.kinematicSteer * this.spec.steer : 0
        let susp = this.spec.suspension * 0.8 - this.spec.suspension * 0.55
        const pi = this.spec.kind === 'bike' ? (i === 0 ? 0 : 2) : i
        if (vc && this.mode === 'dynamic') {
          steer = vc.wheelSteering(pi) ?? 0
          const len = vc.wheelSuspensionLength(pi)
          if (len !== null) susp = this.spec.suspension * 0.8 - len
        }
        w.position.y = this.spec.wheelRadius + susp
        w.rotation.set(this.wheelSpin, steer, 0, 'YXZ')
      }
    }
    if (this.spec.kind === 'bike') {
      const lean = this.driver ? clamp(-this.steerSmoothed * Math.abs(this.speed) * 0.06, -0.6, 0.6) : 0.18
      v.tilt.rotation.z = damp(v.tilt.rotation.z, lean, 6, dt)
    }
    for (const r of v.rotors) r.obj.rotation[r.axis] = this.rotorAngle * (r.axis === 'x' ? 2 : 1)
    if (this.spec.kind === 'heli' && this.mode === 'kinematic') this.rotorAngle += 40 * dt
    // Lights
    const u = v.lights.uniforms
    if (!this.destroyed) {
      const occupied = !!this.driver || this.mode === 'kinematic'
      u.uHead.value = occupied ? 0.4 + night * 3.5 : 0.05
      const braking = this.mode === 'dynamic' ? this.control.throttle < -0.1 && this.speed > 0.5 : this.speed < 1
      u.uTail.value = occupied ? (braking ? 3 : 0.4 + night * 1.2) : 0.05
      u.uSiren.value = this.sirenOn ? 4 : 0
      u.uSirenPhase.value += dt * 3
    }
  }

  dispose() {
    if (this.controller) this.game.physics.world.removeVehicleController(this.controller)
    this.game.physics.removeBody(this.body)
    disposeVehicleVisual(this.visual)
    this.deformed?.dispose()
  }
}
