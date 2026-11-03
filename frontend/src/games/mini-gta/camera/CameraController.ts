import { PerspectiveCamera, Vector3 } from 'three'
import { input } from '../core/input'
import { clamp, damp, dampAngle } from '../core/math'
import { Groups } from '../physics/physics'
import type { Game } from '../game/Game'

const _target = new Vector3()
const _dir = new Vector3()
const _pos = new Vector3()
const _right = new Vector3()

export const CAMERA_SETTINGS = { sensitivity: 0.0022, invertY: false }

/** Third-person orbit camera (on foot, aiming, vehicles, aircraft). */
export class CameraController {
  /** Heading of the view direction (forward = (sin yaw, 0, cos yaw)). */
  yaw = Math.PI
  /** Elevation of the camera above the target (+ = looking down). */
  pitch = 0.25
  private distance = 4.5
  private shoulder = 0
  private fov = 62
  private height = 1.6
  private sinceMouse = 10
  private shake = 0
  private targetSmooth = new Vector3()
  private initialized = false

  constructor(
    private game: Game,
    private camera: PerspectiveCamera,
  ) {}

  addShake(amount: number) {
    this.shake = Math.min(1.5, this.shake + amount)
  }

  update(dt: number, alpha: number) {
    const player = this.game.player
    const blocking = this.game.ui.blocking
    const { dx, dy } = input.consumeMouse()
    if (!blocking && (dx || dy)) {
      this.yaw -= dx * CAMERA_SETTINGS.sensitivity
      this.pitch += dy * CAMERA_SETTINGS.sensitivity * (CAMERA_SETTINGS.invertY ? -1 : 1)
      this.sinceMouse = 0
    } else this.sinceMouse += dt
    if (blocking) {
      this.game.ui.cursor.x += dx
      this.game.ui.cursor.y += dy
    }
    this.pitch = clamp(this.pitch, -0.9, 1.35)

    const v = player.vehicle
    const aiming = player.aiming && !v
    const weapon = player.currentWeapon()
    let wantDist = 4.2
    let wantShoulder = 0.35
    let wantFov = 62
    let wantHeight = 1.55
    if (v) {
      const big = v.spec.length
      wantDist = v.isAircraft ? big * 1.2 + 6 : big * 0.9 + 3.2
      wantHeight = v.isAircraft ? 3 : v.spec.belt + v.spec.cabin.height + 0.6
      wantShoulder = 0
      wantFov = 64 + clamp(Math.abs(v.speed) / 40, 0, 1) * 10
      // Auto-align behind the vehicle when the mouse is idle.
      if (this.sinceMouse > 1.2 && Math.abs(v.speed) > 3) {
        const h = v.heading() + (v.speed < -1 ? Math.PI : 0)
        this.yaw = dampAngle(this.yaw, h, 2.2, dt)
        this.pitch = damp(this.pitch, v.isAircraft ? 0.2 : 0.18, 1.5, dt)
      }
    } else if (aiming) {
      wantDist = weapon.zoomFov < 20 ? 1.2 : 2.2
      wantShoulder = 0.62
      wantFov = weapon.zoomFov
      wantHeight = player.actor.anim.crouch ? 1.0 : 1.55
    } else if (player.actor.anim.crouch) wantHeight = 1.0
    if (player.state === 'dead' || player.state === 'busted') {
      wantDist = 7
      this.yaw += dt * 0.25
    }
    this.distance = damp(this.distance, wantDist, aiming ? 14 : 5, dt)
    this.shoulder = damp(this.shoulder, wantShoulder, 10, dt)
    this.fov = damp(this.fov, wantFov, 10, dt)
    this.height = damp(this.height, wantHeight, 8, dt)

    // Target: interpolated player / vehicle position.
    if (v) v.interp.position(alpha, _target)
    else player.actor.interp.position(alpha, _target)
    _target.y += this.height
    if (!this.initialized) {
      this.targetSmooth.copy(_target)
      this.initialized = true
    }
    // Light smoothing on foot only (vehicles are already interpolated).
    if (v) this.targetSmooth.copy(_target)
    else this.targetSmooth.set(_target.x, damp(this.targetSmooth.y, _target.y, 20, dt), _target.z)

    const p = -this.pitch
    _dir.set(Math.sin(this.yaw) * Math.cos(p), Math.sin(p), Math.cos(this.yaw) * Math.cos(p))
    _right.set(-Math.cos(this.yaw), 0, Math.sin(this.yaw))
    const origin = this.targetSmooth.clone().addScaledVector(_right, this.shoulder)
    _pos.copy(origin).addScaledVector(_dir, -this.distance)
    // Collide with static geometry.
    const toCam = _pos.clone().sub(origin)
    const len = toCam.length()
    toCam.divideScalar(len)
    const hit = this.game.physics.raycast(
      origin.x,
      origin.y,
      origin.z,
      toCam.x,
      toCam.y,
      toCam.z,
      len,
      Groups.rayCamera,
    )
    if (hit) _pos.copy(origin).addScaledVector(toCam, Math.max(0.3, hit.distance - 0.25))
    // Keep above terrain.
    const ground = this.game.city.terrain.heightAt(_pos.x, _pos.z)
    if (_pos.y < ground + 0.4) _pos.y = ground + 0.4

    if (this.shake > 0) {
      const s = this.shake * 0.15
      _pos.x += (Math.random() - 0.5) * s
      _pos.y += (Math.random() - 0.5) * s
      _pos.z += (Math.random() - 0.5) * s
      this.shake = Math.max(0, this.shake - dt * 2.5)
    }
    this.camera.position.copy(_pos)
    this.camera.lookAt(_pos.clone().add(_dir))
    if (Math.abs(this.camera.fov - this.fov) > 0.05) {
      this.camera.fov = this.fov
      this.camera.updateProjectionMatrix()
    }
  }

  /** World-space aim ray from the camera center. */
  aimRay() {
    const o = this.camera.position
    const d = new Vector3()
    this.camera.getWorldDirection(d)
    return { o: o.clone(), d }
  }
}
