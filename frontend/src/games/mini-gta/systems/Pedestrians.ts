import { Vector3 } from 'three'
import { clamp, dampAngle } from '../core/math'
import { Rng } from '../core/rng'
import { type Collider, ColliderDesc, groups, Layer, type RigidBody, RigidBodyDesc } from '../physics/physics'
import { randomLook } from '../procgen/character/characterModel'
import { Actor } from '../entities/Actor'
import type { Vehicle } from '../entities/Vehicle'
import type { Game } from '../game/Game'
import { WEAPONS } from './weapons'

type PedState = 'walk' | 'flee' | 'cower' | 'knocked' | 'dead' | 'idle' | 'fight'

interface Ped {
  actor: Actor
  body: RigidBody
  collider: Collider
  from: number
  to: number
  t: number
  state: PedState
  timer: number
  speed: number
  threat: Vector3 | null
  vel: Vector3
  /** Free-roaming target when not on the sidewalk graph (ejected drivers). */
  free: Vector3 | null
  /** Délai avant le prochain coup (conducteur qui se bat). */
  attackTimer?: number
}

export const PED_SETTINGS = { density: 30 }

const _v = new Vector3()
const _l = new Vector3()

/** Ambient pedestrians walking the sidewalk network, reacting to danger. */
export class Pedestrians {
  private peds: Ped[] = []
  private seated = new Set<Actor>()
  private rng = new Rng(999)
  private spawnTimer = 0

  constructor(private game: Game) {
    game.events.on('noise', (n) => this.onNoise(n.x, n.z, n.radius, n.source))
    game.events.on('actor:killed', ({ actor }) => {
      const ped = this.peds.find((p) => p.actor === actor)
      if (ped) {
        ped.state = 'dead'
        ped.timer = 40
        ped.collider.setEnabled(false)
        game.pickups.spawnMoney(actor.position.x, actor.position.y, actor.position.z, Math.round(this.rng.range(8, 60)))
      }
      this.onNoise(actor.position.x, actor.position.z, 25, null)
    })
  }

  *actors(): Iterable<Actor> {
    for (const p of this.peds) yield p.actor
    yield* this.seated
  }

  private createPed(x: number, y: number, z: number, actor?: Actor): Ped {
    const world = this.game.physics.world
    const body = world.createRigidBody(RigidBodyDesc.kinematicPositionBased().setTranslation(x, y + 0.9, z))
    const collider = world.createCollider(
      ColliderDesc.capsule(0.55, 0.3).setCollisionGroups(
        groups(Layer.Npc, 0xffff & ~Layer.Npc & ~Layer.Static & ~Layer.Prop),
      ),
      body,
    )
    const a = actor ?? new Actor(this.game, randomLook(this.rng), 'civilian', x, y, z)
    a.maxHealth = a.health = actor ? actor.health : 60
    this.game.physics.setOwner(collider, { kind: 'character', ref: a })
    const ped: Ped = {
      actor: a,
      body,
      collider,
      from: 0,
      to: 0,
      t: 0,
      state: 'walk',
      timer: 0,
      speed: this.rng.range(1.1, 1.6),
      threat: null,
      vel: new Vector3(),
      free: null,
    }
    this.peds.push(ped)
    return ped
  }

  /** Create a driver actor parented in a vehicle seat. */
  createSeated(v: Vehicle): Actor {
    const a = new Actor(this.game, randomLook(this.rng), 'civilian', v.position.x, v.position.y, v.position.z)
    a.seatedIn = v
    a.anim.seated = true
    v.visual.tilt.add(a.rig.object)
    a.rig.object.position.copy(v.visual.seat)
    this.seated.add(a)
    return a
  }

  /** Track an actor seated in a vehicle (police crews, pilots). */
  adoptSeated(a: Actor) {
    this.seated.add(a)
  }

  disposeSeated(a: Actor) {
    if (this.seated.delete(a)) a.dispose()
  }

  /**
   * Sort le conducteur de son véhicule : il fuit, ou (« fight ») se retourne contre le voleur à mains nues.
   * Un policier redevient un agent hostile.
   */
  ejectDriver(v: Vehicle, reaction: 'flee' | 'fight' = 'flee') {
    const a = v.driver
    if (!a) return
    v.driver = null
    v.driverAI = null
    this.game.traffic.release(v)
    this.unseat(v, a, 1, reaction)
  }

  /** Les passagers sortent côté passager et s'enfuient. */
  ejectPassenger(v: Vehicle, a: Actor) {
    this.unseat(v, a, -1)
  }

  private unseat(v: Vehicle, a: Actor, side: number, reaction: 'flee' | 'fight' = 'flee') {
    v.visual.root.updateMatrixWorld(true)
    const exit = v.visual.exit
      .clone()
      .setX(v.visual.exit.x * side)
      .applyMatrix4(v.visual.root.matrixWorld)
    a.seatedIn = null
    a.anim.seated = false
    this.game.root.add(a.rig.object)
    a.heading = v.heading()
    a.interp.snap({ x: exit.x, y: Math.max(exit.y, 0), z: exit.z })
    if (!this.seated.delete(a)) return
    if (a.faction === 'police') {
      this.game.police.adoptOfficer(a, exit)
      return
    }
    if (a.dead) {
      a.dispose()
      return
    }
    const ped = this.createPed(exit.x, Math.max(0, exit.y), exit.z, a)
    if (reaction === 'fight') {
      ped.state = 'fight'
      ped.timer = 10
      ped.free = null
      return
    }
    ped.state = 'flee'
    ped.timer = 12
    ped.threat = this.game.player.position.clone()
    ped.free = exit.clone().add(new Vector3(this.rng.range(-30, 30), 0, this.rng.range(-30, 30)))
  }

  /** Conducteur furieux : il rattrape le voleur à pied et le frappe, puis abandonne et s'enfuit. */
  private fight(p: Ped, dt: number) {
    const a = p.actor
    const game = this.game
    const target = game.player.actor
    const pos = a.position
    const dx = target.position.x - pos.x
    const dz = target.position.z - pos.z
    const d = Math.hypot(dx, dz)
    // Le voleur est parti avec la voiture, loin, ou la bagarre a assez duré : il s'enfuit.
    if (p.timer <= 0 || !game.player.alive || game.player.state !== 'foot' || d > 25) {
      p.state = 'flee'
      p.timer = 10
      p.threat = target.position.clone()
      p.free = pos.clone().add(new Vector3(-dx, 0, -dz).normalize().multiplyScalar(30))
      return
    }
    a.heading = Math.atan2(dx, dz)
    p.attackTimer = (p.attackTimer ?? 0) - dt
    if (d > 1.2) {
      const step = Math.min(d - 1.1, 4.8 * dt)
      const nx = pos.x + (dx / d) * step
      const nz = pos.z + (dz / d) * step
      const ny = game.city.terrain.heightAt(nx, nz)
      p.body.setNextKinematicTranslation({ x: nx, y: Math.max(ny, pos.y) + 0.9, z: nz })
      a.anim.speed = 4.8
      return
    }
    p.body.setNextKinematicTranslation(p.body.translation())
    a.anim.speed = 0
    // Coup de poing : l'animation suit le délai entre deux coups (armé, frappe, retour).
    a.anim.attack = p.attackTimer > 0.5 ? Math.min(1, (0.9 - p.attackTimer) / 0.4) : 0
    if (p.attackTimer <= 0) {
      p.attackTimer = 0.9
      game.combat.melee(a, WEAPONS.fists)
    }
  }

  private onNoise(x: number, z: number, radius: number, source: Actor | null) {
    if (radius <= 0) return
    for (const p of this.peds) {
      if (p.state === 'dead' || p.state === 'knocked' || p.actor === source) continue
      const d = Math.hypot(p.actor.position.x - x, p.actor.position.z - z)
      if (d > radius) continue
      if (d < 12 && this.rng.chance(0.35)) {
        p.state = 'cower'
        p.timer = this.rng.range(4, 8)
      } else {
        p.state = 'flee'
        p.timer = this.rng.range(10, 16)
      }
      p.threat = new Vector3(x, 0, z)
    }
  }

  private spawn(player: Vector3) {
    const sw = this.game.city.sidewalk
    // Candidate sidewalk segments around the player, out of the immediate vicinity.
    const near = sw.filter((n) => {
      const d = Math.hypot(n.x - player.x, n.z - player.z)
      return d > 35 && d < 130
    })
    if (!near.length) return
    const n = near[Math.floor(this.rng.next() * near.length)]
    const to = n.links[Math.floor(this.rng.next() * n.links.length)]
    const m = sw[to]
    const t = this.rng.next()
    const x = n.x + (m.x - n.x) * t
    const z = n.z + (m.z - n.z) * t
    if (Math.hypot(x - player.x, z - player.z) < 30) return
    const ped = this.createPed(x, n.y, z)
    ped.from = n.id
    ped.to = to
    ped.t = t
  }

  private removePed(i: number) {
    const p = this.peds[i]
    this.game.physics.removeBody(p.body)
    p.actor.dispose()
    this.peds.splice(i, 1)
  }

  update(dt: number) {
    const game = this.game
    const player = game.player.position
    this.spawnTimer -= dt
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 0.3
      if (this.peds.filter((p) => p.state !== 'dead').length < PED_SETTINGS.density) this.spawn(player)
      for (let i = this.peds.length - 1; i >= 0; i--) {
        const p = this.peds[i]
        const d = Math.hypot(p.actor.position.x - player.x, p.actor.position.z - player.z)
        if (d > 150 || (p.state === 'dead' && p.timer <= 0)) this.removePed(i)
      }
    }
    const sw = game.city.sidewalk
    for (const p of this.peds) {
      const a = p.actor
      p.timer -= dt
      a.anim.handsUp = false
      a.anim.crouch = false
      if (p.state === 'dead') {
        a.anim.speed = 0
        continue
      }
      if (p.state === 'knocked') {
        // Ballistic flight after being hit by a vehicle.
        p.vel.y -= 9.81 * dt
        const pos = a.position
        const nx = pos.x + p.vel.x * dt
        const nz = pos.z + p.vel.z * dt
        let ny = pos.y + p.vel.y * dt
        const ground = game.city.terrain.heightAt(nx, nz)
        if (ny <= ground) {
          ny = ground
          p.vel.multiplyScalar(0.4)
          p.vel.y = 0
          if (p.timer <= 0) {
            p.state = 'flee'
            p.timer = 10
            p.free = null
          }
        }
        p.body.setNextKinematicTranslation({ x: nx, y: ny + 0.9, z: nz })
        a.anim.dead = 0.3
        continue
      }
      if (p.state === 'fight') {
        this.fight(p, dt)
        continue
      }
      if (p.state === 'cower') {
        a.anim.crouch = true
        a.anim.handsUp = true
        a.anim.speed = 0
        if (p.timer <= 0) {
          p.state = 'flee'
          p.timer = 8
        }
        p.body.setNextKinematicTranslation(p.body.translation())
        continue
      }
      if (p.state === 'flee' && p.timer <= 0) {
        p.state = 'walk'
        p.threat = null
        if (p.free) this.snapToGraph(p)
      }
      const speed = p.state === 'flee' ? 5.4 : p.speed
      const pos = a.position
      let tx: number
      let tz: number
      let ty = pos.y
      if (p.free) {
        tx = p.free.x
        tz = p.free.z
        if (Math.hypot(tx - pos.x, tz - pos.z) < 1.5) this.snapToGraph(p)
      } else {
        const A = sw[p.from]
        const B = sw[p.to]
        const len = Math.hypot(B.x - A.x, B.z - A.z) || 1
        p.t += (speed * dt) / len
        if (p.t >= 1) {
          // Next node: random (walk) or away from the threat (flee), avoiding U-turns.
          const options = B.links.filter((l) => l !== A.id)
          let next = options.length ? options[Math.floor(this.rng.next() * options.length)] : A.id
          if (p.state === 'flee' && p.threat && options.length) {
            next = options.reduce(
              (best, id) =>
                Math.hypot(sw[id].x - p.threat!.x, sw[id].z - p.threat!.z) >
                Math.hypot(sw[best].x - p.threat!.x, sw[best].z - p.threat!.z)
                  ? id
                  : best,
              options[0],
            )
          }
          p.from = B.id
          p.to = next
          p.t = 0
        }
        const A2 = sw[p.from]
        const B2 = sw[p.to]
        tx = A2.x + (B2.x - A2.x) * Math.min(1, p.t + 0.02)
        tz = A2.z + (B2.z - A2.z) * Math.min(1, p.t + 0.02)
        // Off the slab while crossing the street.
        const block = game.city.blocks.some((b) => tx > b.x0 && tx < b.x1 && tz > b.z0 && tz < b.z1)
        ty = block ? 0.15 : 0.02
      }
      _v.set(tx - pos.x, 0, tz - pos.z)
      const dist = _v.length()
      if (dist > 0.001) _v.divideScalar(dist)
      const step = Math.min(dist, speed * dt)
      const nx = pos.x + _v.x * step
      const nz = pos.z + _v.z * step
      const ny = p.free
        ? game.city.terrain.heightAt(nx, nz) +
          (game.city.blocks.some((b) => nx > b.x0 && nx < b.x1 && nz > b.z0 && nz < b.z1) ? 0.15 : 0)
        : ty
      p.body.setNextKinematicTranslation({ x: nx, y: ny + 0.9, z: nz })
      if (dist > 0.05) a.heading = dampAngle(a.heading, Math.atan2(_v.x, _v.z), 8, dt)
      a.anim.speed = speed
      a.anim.grounded = true
    }
    this.vehicleHits()
  }

  private snapToGraph(p: Ped) {
    const sw = this.game.city.sidewalk
    const pos = p.actor.position
    let best = sw[0]
    for (const n of sw) if (Math.hypot(n.x - pos.x, n.z - pos.z) < Math.hypot(best.x - pos.x, best.z - pos.z)) best = n
    p.free = Math.hypot(best.x - pos.x, best.z - pos.z) > 2 ? new Vector3(best.x, 0, best.z) : null
    if (!p.free) {
      p.from = best.id
      p.to = best.links[0]
      p.t = 0
    }
  }

  /** Pedestrians hit by fast vehicles are thrown and hurt. */
  /** Dernier choc reçu par un personnage armé (policier, garde), pour ne pas le compter à chaque pas. */
  private struck = new WeakMap<Actor, number>()

  /**
   * Véhicules rapides qui percutent quelqu'un : les piétons sont projetés, les policiers et les ennemis des
   * missions sont blessés ou tués. La marge de détection grandit avec la vitesse, pour que le choc soit vu
   * avant que la capsule du personnage n'arrête la voiture.
   */
  private vehicleHits() {
    const now = this.game.time
    for (const v of this.game.vehicles) {
      if (v.mode !== 'dynamic' || Math.abs(v.speed) < 4 || v.isAircraft) continue
      const inv = v.visual.root.quaternion.clone().invert()
      const lin = v.body.linvel()
      const speed = Math.abs(v.speed)
      const margin = 0.45 + speed / 30
      const touches = (a: Actor) => {
        _l.copy(a.position).sub(v.position).applyQuaternion(inv)
        return (
          Math.abs(_l.x) <= v.spec.width / 2 + margin &&
          Math.abs(_l.z) <= v.spec.length / 2 + margin &&
          _l.y >= -1 &&
          _l.y <= 2.5
        )
      }
      const hit = (a: Actor) => {
        a.damage({ amount: speed * 7, from: v.driver, kind: 'vehicle', dir: { x: lin.x / speed, z: lin.z / speed } })
        this.game.effects.impact(a.chest(new Vector3()), new Vector3(0, 1, 0), 'blood')
        v.body.applyImpulse({ x: -lin.x * 20, y: 0, z: -lin.z * 20 }, true)
      }
      for (const p of this.peds) {
        if (p.state === 'dead' || p.state === 'knocked' || !touches(p.actor)) continue
        p.state = 'knocked'
        p.timer = 1.5
        p.vel.set(lin.x * 0.9, 3 + speed * 0.15, lin.z * 0.9)
        hit(p.actor)
      }
      for (const a of [...this.game.police.actors(), ...this.game.missions.actors()]) {
        if (a.dead || a === v.driver || now - (this.struck.get(a) ?? -Infinity) < 1 || !touches(a)) continue
        this.struck.set(a, now)
        hit(a)
      }
    }
  }

  postStep() {
    for (const p of this.peds) {
      const t = p.body.translation()
      p.actor.pushPosition(t.x, t.y - 0.9, t.z)
      p.actor.anim.speed = clamp(p.actor.anim.speed, 0, 7)
    }
  }

  dispose() {
    for (let i = this.peds.length - 1; i >= 0; i--) this.removePed(i)
    for (const a of this.seated) a.dispose()
    this.seated.clear()
  }

  get count() {
    return this.peds.length
  }

  /** Expose for the police witness checks. */
  nearbyWitnesses(x: number, z: number, radius: number): number {
    let n = 0
    for (const p of this.peds)
      if (p.state !== 'dead' && Math.hypot(p.actor.position.x - x, p.actor.position.z - z) < radius) n++
    return n
  }
}
