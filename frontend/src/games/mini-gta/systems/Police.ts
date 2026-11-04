import { SpotLight, Vector3 } from 'three'
import { Rng } from '../core/rng'
import { Groups } from '../physics/physics'
import { policeLook } from '../procgen/character/characterModel'
import { Actor } from '../entities/Actor'
import { CombatNpc } from '../entities/CombatNpc'
import type { Vehicle } from '../entities/Vehicle'
import type { Game } from '../game/Game'
import { DriverAI } from './DriverAI'
import { WantedLevel, type Crime } from './Wanted'

interface Unit {
  vehicle: Vehicle
  ai: DriverAI
  roadblock: boolean
  /** Seconds spent nearly stopped (deploy the crew when stuck). */
  stuck: number
}

const CARS_PER_STAR = [0, 1, 2, 3, 3, 4]
const _v = new Vector3()

/** Wanted level, crime detection, dispatch of police units and their behaviour. */
export class Police {
  readonly wanted = new WantedLevel()
  private units: Unit[] = []
  private officers: CombatNpc[] = []
  private heli: Vehicle | null = null
  private heliAngle = 0
  private heliFire = 3
  private spotlight: SpotLight
  private dispatchTimer = 2
  private roadblockTimer = 20
  private bustTimer = 0
  private rng = new Rng(1717)
  private seenTimer = 0
  private seen = false

  constructor(private game: Game) {
    this.spotlight = new SpotLight(0xe8f0ff, 0, 140, 0.22, 0.5, 1)
    game.root.add(this.spotlight)
    game.root.add(this.spotlight.target)
    const isPlayer = (a: Actor | null | undefined) => !!a && a === game.player.actor
    game.events.on('noise', ({ x, z, source, radius }) => {
      if (isPlayer(source) && radius > 30) this.crime(radius > 150 ? 'explosion' : 'shooting', x, z)
    })
    game.events.on('actor:killed', ({ actor, info }) => {
      if (!isPlayer(info.from)) return
      this.crime(actor.faction === 'police' ? 'killCop' : 'killCivilian', actor.position.x, actor.position.z)
    })
    game.events.on('actor:hurt', ({ actor, info }) => {
      if (!isPlayer(info.from)) return
      this.crime(
        actor.faction === 'police' ? 'attackCop' : 'assault',
        actor.position.x,
        actor.position.z,
        actor.faction === 'police' ? 2 : 0,
      )
    })
    game.events.on('vehicle:entered', ({ vehicle, jacked }) => {
      if (vehicle.spec.police) this.crime('policeVehicle', vehicle.position.x, vehicle.position.z)
      else if (jacked) this.crime('carjack', vehicle.position.x, vehicle.position.z)
    })
    game.events.on('vehicle:attacked', ({ vehicle }) => {
      if (vehicle.spec.police) this.crime('policeVehicle', vehicle.position.x, vehicle.position.z, 1)
    })
  }

  *actors(): Iterable<Actor> {
    for (const o of this.officers) yield o.actor
  }

  /** A crime is witnessed if a cop is near with line of sight, or civilians are around. */
  crime(kind: Crime, x: number, z: number, minStars = 0) {
    const game = this.game
    let witnessed = this.wanted.stars > 0
    if (!witnessed) {
      for (const o of this.officers)
        if (!o.actor.dead && o.actor.position.distanceTo(_v.set(x, o.actor.position.y, z)) < 60) witnessed = true
      for (const u of this.units)
        if (u.vehicle.position.distanceTo(_v.set(x, u.vehicle.position.y, z)) < 60) witnessed = true
      if (!witnessed)
        witnessed =
          game.peds.nearbyWitnesses(x, z, 35) > 0 ||
          kind === 'killCop' ||
          kind === 'attackCop' ||
          kind === 'policeVehicle'
    }
    const before = this.wanted.stars
    this.wanted.commit(kind, x, z, witnessed, minStars)
    if (this.wanted.stars > before) this.dispatchTimer = Math.min(this.dispatchTimer, 1)
  }

  /** Officer leaving a vehicle (from Pedestrians.unseat). */
  adoptOfficer(actor: Actor, at: Vector3) {
    // Stand on the real ground (sidewalk slabs are higher than the road).
    const ground = this.game.physics.raycast(at.x, at.y + 3, at.z, 0, -1, 0, 10, Groups.rayWorld)
    const y = ground ? ground.y + 0.05 : Math.max(0, at.y)
    actor.interp.snap({ x: at.x, y, z: at.z })
    const npc = new CombatNpc(this.game, actor, actor.tags.has('swat') ? 'rifle' : 'pistol')
    npc.accuracy = actor.tags.has('swat') ? 0.6 : 0.42
    this.officers.push(npc)
  }

  private spawnUnit(roadblock = false, at?: { x: number; z: number; heading: number }) {
    const game = this.game
    const p = game.player.position
    const swat = this.wanted.stars >= 5 && this.units.filter((u) => u.vehicle.spec.id === 'swat').length < 2
    let x: number
    let z: number
    let heading: number
    if (at) {
      x = at.x
      z = at.z
      heading = at.heading
    } else {
      const edges = game.nav.edgesInRing(p.x, p.z, 110, 180)
      if (!edges.length) return
      let found: { x: number; z: number; heading: number } | null = null
      for (let k = 0; k < 20 && !found; k++) {
        const e = edges[Math.floor(this.rng.next() * edges.length)]
        const g = game.city.roads.graph
        const pt = g.lanePoint(e, 1, 0, e.length * this.rng.range(0.15, 0.85))
        const d = Math.hypot(pt.x - p.x, pt.z - p.z)
        if (d < 110 || d > 180) continue
        // Face the player's side of the edge so the car does not start by driving away.
        const dir = g.direction(e, 1)
        const towards = (p.x - pt.x) * dir.x + (p.z - pt.z) * dir.z > 0
        found = { x: pt.x, z: pt.z, heading: Math.atan2(dir.x, dir.z) + (towards ? 0 : Math.PI) }
      }
      if (!found) return
      x = found.x
      z = found.z
      heading = found.heading
    }
    const y = game.city.terrain.heightAt(x, z) + 0.4
    const v = game.spawnVehicle(swat ? 'swat' : 'police', x, y, z, heading, 'dynamic')
    v.sirenOn = true
    v.tags.add('police')
    const crew = swat ? 3 : 2
    for (let i = 0; i < crew; i++) {
      const a = new Actor(game, policeLook(this.rng, swat), 'police', x, y, z)
      if (swat) {
        a.tags.add('swat')
        a.armor = 60
      }
      a.seatedIn = v
      a.anim.seated = true
      v.visual.tilt.add(a.rig.object)
      a.rig.object.position.copy(v.visual.seat)
      if (i > 0) a.rig.object.position.x = -v.visual.seat.x
      if (i > 1) a.rig.object.position.z -= 1.2
      game.peds.adoptSeated(a)
      if (i === 0) v.driver = a
      else v.passengers.push(a)
    }
    const ai = new DriverAI(game, roadblock ? 'park' : 'chase', () => game.player.position)
    ai.directRange = 60
    ai.maxSpeed = this.wanted.stars >= 3 ? 30 : 22
    ai.aggressive = this.wanted.stars >= 3
    v.driverAI = ai
    this.units.push({ vehicle: v, ai, roadblock, stuck: 0 })
  }

  private spawnRoadblock() {
    const game = this.game
    const pv = game.player.vehicle
    if (!pv || Math.abs(pv.speed) < 8) return
    const f = pv.forward(new Vector3())
    const ahead = pv.position.clone().addScaledVector(f, 150)
    const hit = game.nav.nearestEdge(ahead.x, ahead.z, 80)
    if (!hit) return
    const g = game.city.roads.graph
    const a = g.nodes[hit.edge.a]
    const b = g.nodes[hit.edge.b]
    const cx = a.x + (b.x - a.x) * hit.t
    const cz = a.z + (b.z - a.z) * hit.t
    const d = g.direction(hit.edge, 1)
    const across = Math.atan2(d.x, d.z) + Math.PI / 2
    for (const off of [-2.6, 2.6]) {
      this.spawnUnit(true, { x: cx - d.z * off, z: cz + d.x * off, heading: across })
      const u = this.units[this.units.length - 1]
      if (u) for (const p of [u.vehicle.driver, ...u.vehicle.passengers]) if (p) game.peds.ejectPassenger(u.vehicle, p)
      if (u) {
        u.vehicle.driver = null
        u.vehicle.passengers = []
      }
    }
    game.events.emit('notify', { text: 'Barrage de police devant !', kind: 'info' })
  }

  private updateHeli(dt: number) {
    const game = this.game
    const want = this.wanted.stars >= 3
    const p = game.player.position
    if (want && !this.heli) {
      const y = game.city.terrain.heightAt(p.x, p.z) + 60
      this.heli = game.spawnVehicle('policeHeli', p.x + 200, y, p.z + 200, 0, 'kinematic')
      this.heli.tags.add('police')
      this.heli.driver = new Actor(game, policeLook(this.rng), 'police', p.x, y, p.z)
      this.heli.driver.seatedIn = this.heli
      this.heli.visual.tilt.add(this.heli.driver.rig.object)
      this.heli.driver.rig.object.position.copy(this.heli.visual.seat)
      game.peds.adoptSeated(this.heli.driver)
    }
    const h = this.heli
    if (!h) return
    if (h.destroyed || h.mode === 'dynamic') {
      this.spotlight.intensity = 0
      if (h.position.distanceTo(p) > 300) {
        game.removeVehicle(h)
        this.heli = null
      }
      return
    }
    this.heliAngle += dt * 0.25
    const leaving = !want
    const r = leaving ? 400 : 45
    const tx = p.x + Math.cos(this.heliAngle) * r
    const tz = p.z + Math.sin(this.heliAngle) * r
    const ty = Math.max(game.city.terrain.heightAt(tx, tz), 0) + (leaving ? 80 : 38)
    const pos = h.position
    const k = Math.min(1, dt * (leaving ? 0.3 : 0.6))
    const nx = pos.x + (tx - pos.x) * k
    const ny = pos.y + (ty - pos.y) * k
    const nz = pos.z + (tz - pos.z) * k
    const heading = Math.atan2(p.x - nx, p.z - nz)
    h.setPose(nx, ny, nz, heading, 10)
    if (leaving && pos.distanceTo(p) > 350) {
      game.removeVehicle(h)
      this.heli = null
      this.spotlight.intensity = 0
      return
    }
    // Spotlight at night
    this.spotlight.position.set(nx, ny - 1, nz)
    this.spotlight.target.position.copy(p)
    this.spotlight.intensity = game.env.night * 4000
    // Sniper
    if (this.wanted.stars >= 4 && !leaving) {
      this.heliFire -= dt
      if (this.heliFire <= 0) {
        this.heliFire = 2.5 + Math.random() * 2
        const target = game.player.actor.chest(new Vector3())
        if (game.physics.lineOfSight(nx, ny - 2, nz, target.x, target.y, target.z)) {
          game.combat.npcFire(h.driver!, target, 0.35, 'sniper', h.body)
        }
      }
    }
  }

  update(dt: number) {
    const game = this.game
    const player = game.player
    const p = player.position
    const stars = this.wanted.stars

    // Visibility (throttled raycasts).
    this.seenTimer -= dt
    if (this.seenTimer <= 0) {
      this.seenTimer = 0.25
      // Seen by an officer, or one is right next to the player (can't hide at arm's length).
      this.seen = this.officers.some((o) => !o.actor.dead && (o.sees() || o.actor.position.distanceTo(p) < 20))
      if (!this.seen) {
        for (const u of this.units) {
          const v = u.vehicle
          if (!v.driver || v.destroyed) continue
          const d = v.position.distanceTo(p)
          if (d < 80 && game.physics.lineOfSight(v.position.x, v.position.y + 1.5, v.position.z, p.x, p.y + 1.2, p.z))
            this.seen = true
        }
      }
      if (
        this.heli &&
        !this.heli.destroyed &&
        this.heli.position.distanceTo(p) < 140 &&
        game.physics.lineOfSight(
          this.heli.position.x,
          this.heli.position.y - 2,
          this.heli.position.z,
          p.x,
          p.y + 1.2,
          p.z,
        )
      )
        this.seen = true
    }
    if (player.alive) {
      const lost = this.wanted.update(dt, this.seen, p.x, p.z)
      if (lost) game.events.emit('notify', { text: 'Tu as semé la police', kind: 'success' })
    }

    // Dispatch
    this.dispatchTimer -= dt
    if (this.dispatchTimer <= 0 && stars > 0 && player.alive) {
      this.dispatchTimer = 6
      const active = this.units.filter((u) => !u.roadblock && !u.vehicle.destroyed && u.vehicle.driver).length
      if (active < CARS_PER_STAR[stars]) this.spawnUnit()
      const footCount = this.officers.filter((o) => !o.actor.dead).length
      if (footCount < stars * 2 && player.state === 'foot' && active < CARS_PER_STAR[stars] + 1 && this.rng.chance(0.4))
        this.spawnUnit()
    }
    if (stars >= 4) {
      this.roadblockTimer -= dt
      if (this.roadblockTimer <= 0) {
        this.roadblockTimer = 35
        this.spawnRoadblock()
      }
    }
    this.updateHeli(dt)

    // Units: chase, then deploy officers when close.
    for (const u of this.units) {
      const v = u.vehicle
      if (stars === 0) {
        v.sirenOn = false
        if (u.ai.mode !== 'cruise') {
          u.ai.mode = 'cruise'
          u.ai.maxSpeed = 13
          u.ai.path = []
        }
        continue
      }
      if (u.roadblock || !v.driver || v.destroyed) continue
      const d = v.position.distanceTo(p)
      const slow = player.state === 'foot' || Math.abs(player.vehicle?.speed ?? 0) < 4
      u.stuck = Math.abs(v.speed) < 1.5 ? u.stuck + dt : 0
      const deploy = player.state === 'foot' ? 55 : 22
      if ((d < deploy && slow && Math.abs(v.speed) < 6) || (u.stuck > 3 && d < 80)) {
        const crew = [v.driver, ...v.passengers]
        v.driver = null
        v.passengers = []
        v.driverAI = null
        for (const a of crew) game.peds.ejectPassenger(v, a)
      }
    }

    // Officers
    for (const o of this.officers) {
      if (stars === 0) {
        o.mode = 'idle'
        o.actor.anim.aiming = false
      } else {
        o.hostile = stars >= 2 || player.state === 'vehicle'
        o.mode = !o.hostile && player.state === 'foot' ? 'arrest' : 'chase'
      }
      o.update(dt)
    }

    // Busted (low wanted level, on foot, a cop at arm's length).
    if (stars > 0 && stars <= 2 && player.state === 'foot') {
      const close = this.officers.some((o) => !o.actor.dead && o.actor.position.distanceTo(p) < 1.9)
      this.bustTimer = close && player.actor.anim.speed < 2.5 ? this.bustTimer + dt : Math.max(0, this.bustTimer - dt)
      if (this.bustTimer > 1.4) {
        this.bustTimer = 0
        player.state = 'busted'
        player.stateTimer = 0
        player.actor.anim.handsUp = true
        game.events.emit('player:busted', {})
      }
    } else this.bustTimer = 0

    this.cleanup(p)
  }

  private cleanup(p: Vector3) {
    const game = this.game
    for (let i = this.officers.length - 1; i >= 0; i--) {
      const o = this.officers[i]
      const d = o.actor.position.distanceTo(p)
      o.despawnTimer = o.actor.dead ? o.despawnTimer + 1 / 60 : 0
      if (d > 180 || (this.wanted.stars === 0 && d > 70) || o.despawnTimer > 30) {
        o.dispose()
        this.officers.splice(i, 1)
      }
    }
    for (let i = this.units.length - 1; i >= 0; i--) {
      const v = this.units[i].vehicle
      const d = v.position.distanceTo(p)
      if (v === game.player.vehicle) {
        this.units.splice(i, 1)
        continue
      }
      if (d > 320 || (this.wanted.stars === 0 && d > 160) || (this.units[i].roadblock && d > 250)) {
        game.removeVehicle(v)
        this.units.splice(i, 1)
      }
    }
  }

  postStep() {
    for (const o of this.officers) if (!o.actor.dead) o.postStep()
  }

  /** Remove every unit (respawn). */
  clear() {
    this.wanted.clear()
    for (const o of this.officers) o.dispose()
    this.officers = []
    for (const u of this.units) if (u.vehicle !== this.game.player.vehicle) this.game.removeVehicle(u.vehicle)
    this.units = []
    if (this.heli) this.game.removeVehicle(this.heli)
    this.heli = null
    this.spotlight.intensity = 0
  }

  dispose() {
    this.clear()
    this.spotlight.removeFromParent()
  }
}
