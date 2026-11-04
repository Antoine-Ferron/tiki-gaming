import { Vector3 } from 'three'
import { dampAngle } from '../core/math'
import { Layer, groups } from '../physics/physics'
import { Actor } from './Actor'
import { CharacterBody } from './CharacterBody'
import type { WeaponId } from '../systems/weapons'
import type { Game } from '../game/Game'

export type NpcMode = 'idle' | 'guard' | 'chase' | 'arrest' | 'flee' | 'cover'

const _t = new Vector3()
const _c = new Vector3()

/** Armed NPC with a character controller: police officers, SWAT, mission guards. */
export class CombatNpc {
  readonly body: CharacterBody
  mode: NpcMode = 'chase'
  accuracy = 0.45
  weaponId: WeaponId
  /** Fire allowed (police only fires above 2 stars). */
  hostile = true
  // Le premier tir attend surtout le temps de réaction (voir `reaction`).
  private fireTimer = 0.2 + Math.random() * 0.4
  private burst = 0
  private strafe = 0
  private strafeTimer = 0
  private lastPos = new Vector3()
  private stuckTimer = 0
  sight = 70
  /** Guard post (mission guards return here when idle). */
  post: Vector3 | null = null
  despawnTimer = 0
  private path: Vector3[] = []
  private repath = 0
  /** Temps de réaction restant avant d'ouvrir le feu sur une cible qui vient d'apparaître. */
  private reaction = 0
  private sawTarget = false
  /** Durée de visée continue : la précision s'affine. */
  private aimTime = 0
  /** Point d'abri visé quand il est blessé, et durée de repli. */
  private cover: Vector3 | null = null
  private coverTimer = 0
  private coverCooldown = 0
  private retreatTimer = 0

  constructor(
    private game: Game,
    readonly actor: Actor,
    weapon: WeaponId,
  ) {
    const p = actor.position
    this.body = new CharacterBody(
      game.physics,
      p.x,
      p.y,
      p.z,
      groups(Layer.Npc, 0xffff & ~Layer.Npc & ~Layer.Sensor),
      false,
    )
    game.physics.setOwner(this.body.collider, { kind: 'character', ref: actor })
    this.weaponId = weapon
    actor.setWeapon(weapon)
  }

  /** Can this NPC see the player? */
  sees(): boolean {
    const player = this.game.player
    if (!player.alive) return false
    const target = player.vehicle
      ? player.vehicle.position.clone().setY(player.vehicle.position.y + 1)
      : player.actor.chest(_t)
    const me = this.actor.chest(_c)
    if (me.distanceTo(target) > this.sight) return false
    return this.game.physics.lineOfSight(me.x, me.y + 0.2, me.z, target.x, target.y, target.z)
  }

  update(dt: number) {
    const a = this.actor
    if (a.dead) {
      this.body.setEnabled(false)
      return
    }
    const game = this.game
    const player = game.player
    const target = player.vehicle ? player.vehicle.position : player.actor.position
    const toX = target.x - a.position.x
    const toZ = target.z - a.position.z
    const dist = Math.hypot(toX, toZ)
    const sees = this.sees()
    a.tickReactions(dt)
    this.coverCooldown -= dt
    if (sees && !this.sawTarget) this.reaction = this.reactionTime()
    this.sawTarget = sees
    this.reaction = Math.max(0, this.reaction - dt)
    this.aimTime = sees ? this.aimTime + dt : 0
    // Blessé et exposé : il cherche un abri (ou recule en tirant s'il n'en trouve pas).
    if (this.mode === 'chase' && sees && a.health < a.maxHealth * 0.5 && this.coverCooldown <= 0) {
      this.coverCooldown = 7
      this.cover = this.findCover()
      if (this.cover) {
        this.mode = 'cover'
        this.coverTimer = 2.5 + Math.random() * 1.5
      } else this.retreatTimer = 1.5
    }
    let vx = 0
    let vz = 0
    let aiming = false

    if (this.mode === 'chase' || this.mode === 'arrest') {
      const wantDist = this.mode === 'arrest' ? 1.2 : sees ? 11 : 2
      const navigate = !sees || dist > 25
      if (navigate && dist > wantDist) {
        // Walk along the sidewalks to get around blocks.
        const wp = this.waypoint(dt, target)
        const dx = wp.x - a.position.x
        const dz = wp.z - a.position.z
        const l = Math.hypot(dx, dz) || 1
        vx = (dx / l) * 5.5
        vz = (dz / l) * 5.5
      } else if (dist > wantDist) {
        const sp = this.mode === 'arrest' ? 5.5 : 3
        vx = (toX / dist) * sp
        vz = (toZ / dist) * sp
      } else if (this.mode === 'chase' && sees) {
        // Strafe while shooting.
        this.strafeTimer -= dt
        if (this.strafeTimer <= 0) {
          this.strafeTimer = 1 + Math.random() * 2
          this.strafe = (Math.random() - 0.5) * 2
        }
        vx = (-toZ / dist) * this.strafe * 2
        vz = (toX / dist) * this.strafe * 2
      }
      aiming = this.mode === 'chase' && sees && dist < this.sight && this.hostile
    } else if (this.mode === 'guard') {
      if (sees && dist < 35) this.mode = 'chase'
      else if (this.post && this.post.distanceTo(a.position) > 2) {
        const dx = this.post.x - a.position.x
        const dz = this.post.z - a.position.z
        const l = Math.hypot(dx, dz)
        vx = (dx / l) * 1.4
        vz = (dz / l) * 1.4
      }
    } else if (this.mode === 'cover' && this.cover) {
      this.coverTimer -= dt
      const dx = this.cover.x - a.position.x
      const dz = this.cover.z - a.position.z
      const l = Math.hypot(dx, dz)
      if (l > 0.6) {
        vx = (dx / l) * 5.5
        vz = (dz / l) * 5.5
      }
      // À l'abri, il attend puis ressort reprendre la poursuite.
      if (this.coverTimer <= 0) {
        this.mode = 'chase'
        this.cover = null
      }
    } else if (this.mode === 'flee') {
      vx = (-toX / (dist || 1)) * 5
      vz = (-toZ / (dist || 1)) * 5
    }

    if (this.retreatTimer > 0 && this.mode === 'chase') {
      this.retreatTimer -= dt
      vx = (-toX / (dist || 1)) * 3
      vz = (-toZ / (dist || 1)) * 3
    }
    // Sonné par un impact : il ralentit et subit le recul.
    if (a.stagger > 0) {
      vx *= 0.45
      vz *= 0.45
    }
    vx += a.knock.x
    vz += a.knock.z

    // Unstick: sidestep when not progressing.
    if (Math.hypot(vx, vz) > 1 && this.lastPos.distanceTo(a.position) < 0.02) this.stuckTimer += dt
    else this.stuckTimer = Math.max(0, this.stuckTimer - dt)
    if (this.stuckTimer > 0.6) {
      const side = Math.random() < 0.5 ? 1 : -1
      const ox = vx
      vx = -vz * side
      vz = ox * side
      if (this.stuckTimer > 1.6) this.stuckTimer = 0
    }
    this.lastPos.copy(a.position)
    this.body.move(vx, vz, false, dt)

    const speed = Math.hypot(vx, vz)
    if (aiming || this.mode === 'arrest') a.heading = dampAngle(a.heading, Math.atan2(toX, toZ), 10, dt)
    else if (speed > 0.3) a.heading = dampAngle(a.heading, Math.atan2(vx, vz), 8, dt)
    a.anim.speed = speed
    a.anim.grounded = this.body.grounded
    a.anim.aiming = aiming
    a.anim.aimPitch = Math.atan2(target.y - a.position.y, Math.max(1, dist)) * 0.8

    if (aiming && this.reaction <= 0) {
      this.fireTimer -= dt
      if (this.fireTimer <= 0) {
        const auto = this.weaponId === 'rifle'
        const aim = player.vehicle
          ? player.vehicle.position.clone().setY(player.vehicle.position.y + 1)
          : player.actor.chest(new Vector3())
        const acc = npcAccuracy(this.accuracy, {
          distance: dist,
          targetSpeed: player.vehicle ? Math.abs(player.vehicle.speed) : player.actor.anim.speed,
          aimTime: this.aimTime,
          wounded: a.health < a.maxHealth * 0.5,
          staggered: a.stagger > 0,
        })
        game.combat.npcFire(a, aim, acc, this.weaponId, this.body.body)
        // Rafales courtes : 3 à 5 balles au fusil d'assaut, 1 ou 2 au pistolet, puis une pause.
        const burstLength = auto ? 3 + Math.floor(Math.random() * 3) : 1 + Math.floor(Math.random() * 2)
        if (++this.burst < burstLength) {
          this.fireTimer = auto ? 0.11 : 0.3
        } else {
          this.burst = 0
          this.fireTimer = (auto ? 1.1 : 0.9) + Math.random() * 0.9
        }
      }
    }
  }

  /** Temps de réaction (s) avant de tirer sur une cible qui vient d'apparaître ; les SWAT sont plus vifs. */
  private reactionTime() {
    return (0.35 + Math.random() * 0.5) * (this.actor.tags.has('swat') ? 0.7 : 1)
  }

  /**
   * Abri le plus proche : un point accessible en ligne droite d'où l'on ne voit plus le joueur (un mur, une
   * voiture ou un coin de bâtiment s'interpose). Null s'il n'y en a pas à moins de 12 m.
   */
  private findCover(): Vector3 | null {
    const ph = this.game.physics
    const me = this.actor.position
    const threat = this.game.player.actor.chest(new Vector3())
    let best: Vector3 | null = null
    let bestD = Infinity
    for (const r of [4, 7, 11]) {
      for (let k = 0; k < 12; k++) {
        const ang = (k / 12) * Math.PI * 2
        const p = new Vector3(me.x + Math.sin(ang) * r, me.y, me.z + Math.cos(ang) * r)
        if (!ph.lineOfSight(me.x, me.y + 1, me.z, p.x, p.y + 1, p.z)) continue
        if (ph.lineOfSight(p.x, p.y + 1.2, p.z, threat.x, threat.y, threat.z)) continue
        if (r < bestD) {
          bestD = r
          best = p
        }
      }
      if (best) return best
    }
    return best
  }

  /** Next point to walk to (sidewalk graph path, recomputed every 2 s). */
  private waypoint(dt: number, target: Vector3): Vector3 {
    const a = this.actor.position
    this.repath -= dt
    if (this.repath <= 0 || this.path.length === 0) {
      this.repath = 2
      const ph = this.game.physics
      const visible = (p: { x: number; z: number }, q: { x: number; z: number }) =>
        ph.lineOfSight(p.x, a.y + 1, p.z, q.x, a.y + 1, q.z)
      this.path = this.game.walkNav.path(a, target, visible)
      while (this.path.length >= 2) {
        const p0 = this.path[0]
        const p1 = this.path[1]
        if (Math.hypot(p1.x - a.x, p1.z - a.z) < Math.hypot(p1.x - p0.x, p1.z - p0.z) && visible(a, p1))
          this.path.shift()
        else break
      }
    }
    while (this.path.length > 1 && Math.hypot(this.path[0].x - a.x, this.path[0].z - a.z) < 2.5) this.path.shift()
    return this.path[0] ?? target
  }

  postStep() {
    this.actor.pushPosition(this.body.x, this.body.feetY, this.body.z)
  }

  dispose() {
    this.body.dispose()
    this.actor.dispose()
  }
}

/**
 * Précision d'un PNJ (0 à 1) : sa compétence, dégradée par la distance, une cible rapide ou sa propre blessure,
 * affinée par le temps passé à viser.
 */
export function npcAccuracy(
  base: number,
  c: { distance: number; targetSpeed: number; aimTime: number; wounded: boolean; staggered: boolean },
): number {
  const range = 1 - Math.min(1, Math.max(0, (c.distance - 8) / 70)) * 0.55
  const motion = c.targetSpeed > 5 ? 0.55 : c.targetSpeed > 1 ? 0.8 : 1.15
  const settle = Math.min(0.2, c.aimTime * 0.07)
  const hurt = (c.wounded ? 0.85 : 1) * (c.staggered ? 0.6 : 1)
  return Math.min(0.95, Math.max(0.05, base * range * motion * hurt + settle))
}
