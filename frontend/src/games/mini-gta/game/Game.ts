import { Group, type PerspectiveCamera, type Scene, SpotLight, Vector3, type WebGLRenderer } from 'three'
import { EventBus, type GameEvents } from '../core/events'
import { input } from '../core/input'
import { CameraController } from '../camera/CameraController'
import { groups, Layer, Physics } from '../physics/physics'

/** Surfaces sur lesquelles un véhicule peut apparaître (pas les props : un arbre n'est pas un sol). */
const SPAWN_GROUND = groups(0xffff, Layer.Static | Layer.Curb)
import { buildStaticWorld } from '../physics/staticWorld'
import { Effects } from '../render/Effects'
import { Environment } from '../render/Environment'
import { sharedUniforms } from '../render/materials'
import { REFLECT_LAYER, Reflections } from '../render/Reflections'
import { setVehicleEnvMap } from '../render/vehicleMaterials'
import { Player } from '../entities/Player'
import { Vehicle } from '../entities/Vehicle'
import { Actor } from '../entities/Actor'
import { Rng } from '../core/rng'
import { policeLook, randomLook } from '../procgen/character/characterModel'
import { cityFromDto, type CityData } from '../world/city'
import { Navigation } from '../world/navigation'
import { WalkNav } from '../world/walkNav'
import { WorldRenderer } from '../world/WorldRenderer'
import { Combat } from '../systems/Combat'
import { Traffic } from '../systems/Traffic'
import { Pedestrians } from '../systems/Pedestrians'
import { Police } from '../systems/Police'
import { Missions } from '../systems/missions/Missions'
import { Pickups } from '../systems/Pickups'
import { Interactions } from '../systems/Interactions'
import { DriverAI } from '../systems/DriverAI'
import { publishHud } from '../state/hudStore'
import { useGameStore } from '../state/gameStore'
import { api } from '../net/api'
import { loadWeaponDefs } from '../systems/weapons'
import { loadInventory, saveGame } from '../state/save'
import { formatMoney } from '../domain/format'

export interface UiState {
  /** A menu is open: gameplay input is ignored. */
  blocking: boolean
  /** Mouse deltas accumulated while a menu captures the pointer (weapon wheel). */
  cursor: { x: number; y: number }
}

/** Owns the simulation: physics world, city, entities and systems. */
export class Game {
  readonly root = new Group()
  readonly events = new EventBus<GameEvents>()
  readonly vehicles = new Set<Vehicle>()
  readonly ui: UiState = { blocking: false, cursor: { x: 0, y: 0 } }
  time = 0
  frame = 0
  physics!: Physics
  city!: CityData
  nav!: Navigation
  walkNav!: WalkNav
  world!: WorldRenderer
  env!: Environment
  effects!: Effects
  combat!: Combat
  player!: Player
  cameraCtl!: CameraController
  traffic!: Traffic
  peds!: Pedestrians
  police!: Police
  missions!: Missions
  pickups!: Pickups
  interactions!: Interactions
  debug = { physics: false, freezeTraffic: false }
  private camPos = new Vector3()
  /** Headlights of the player's vehicle (single shadowless spot light). */
  reflections!: Reflections
  private headlight = new SpotLight(0xfff2d8, 0, 60, 0.5, 0.45, 1.2)
  private hudTimer = 0
  private disposed = false

  constructor(
    readonly scene: Scene,
    readonly camera: PerspectiveCamera,
    readonly renderer: WebGLRenderer,
  ) {}

  async init(onProgress: (text: string, p: number) => void) {
    const step = async (text: string, p: number) => {
      onProgress(text, p)
      await new Promise((r) => setTimeout(r, 0))
    }
    await step('Connexion au serveur…', 0.02)
    // Le backend génère la ville (seed fixe) et détient le catalogue des missions et des armes.
    const [world, missions, weapons] = await Promise.all([api.world(), api.missions(), api.weapons()])
    loadWeaponDefs(weapons)
    await step('Initialisation de la physique…', 0.1)
    this.physics = new Physics()
    await step('Chargement de la ville…', 0.15)
    this.city = cityFromDto(world)
    this.nav = new Navigation(this.city.roads.graph)
    this.walkNav = new WalkNav(this.city.sidewalk)
    await step('Collisions…', 0.35)
    buildStaticWorld(this.physics, this.city)
    this.scene.add(this.root)
    this.root.add(this.headlight, this.headlight.target)
    this.effects = new Effects()
    this.root.add(this.effects.group)
    this.env = new Environment(this.scene, this.renderer)
    this.reflections = new Reflections(256)
    setVehicleEnvMap(this.reflections.texture)
    this.camera.layers.enable(REFLECT_LAYER)
    this.world = new WorldRenderer(this, this.city)
    this.root.add(this.world.group)
    this.combat = new Combat(this)

    await step('Construction du quartier…', 0.5)
    const save = useGameStore.getState()
    const spawn = this.city.locations.spawn
    this.player = new Player(this, spawn.x, spawn.y, spawn.z)
    this.player.actor.heading = spawn.heading ?? 0
    loadInventory(this.player.inventory, save.inventory)
    this.player.actor.armor = save.armor
    this.cameraCtl = new CameraController(this, this.camera)
    this.cameraCtl.yaw = spawn.heading ?? 0
    this.world.prebuild(spawn.x, spawn.z, 420)

    await step('Habitants et trafic…', 0.8)
    this.traffic = new Traffic(this)
    this.peds = new Pedestrians(this)
    this.police = new Police(this)
    this.pickups = new Pickups(this)
    this.interactions = new Interactions(this)
    this.missions = new Missions(this, missions)

    // Starter vehicles near the safehouse and at the airfield.
    const g = this.city.locations.garage
    this.spawnVehicle('sedan', g.x, g.y + 0.3, g.z, g.heading ?? 0, 'dynamic', '#8a1c1c').persistent = true
    const ps = this.city.locations.planeSpawn
    this.spawnVehicle('plane', ps.x, ps.y + 0.2, ps.z, ps.heading ?? 0, 'dynamic').persistent = true
    const hs = this.city.locations.heliSpawn
    this.spawnVehicle('heli', hs.x, hs.y + 0.2, hs.z, 0, 'dynamic').persistent = true
    this.spawnVehicle('bike', hs.x - 20, 0.3, hs.z - 30, 0, 'dynamic').persistent = true

    this.events.on('player:died', () => {
      this.events.emit('notify', { text: 'K.O.', kind: 'big' })
    })
    this.events.on('player:busted', () => {
      this.events.emit('notify', { text: 'ARRÊTÉ', kind: 'big' })
    })
    await step('Prêt', 1)
  }

  /** Static actors spawned from the debug tools (character previews). */
  readonly debugActors: Actor[] = []

  debugSpawnActor(x: number, z: number, heading: number, seed: number, police = false) {
    const rng = new Rng(seed)
    const look = police ? policeLook(rng) : randomLook(rng)
    const a = new Actor(this, look, 'civilian', x, this.city.terrain.heightAt(x, z) + 0.15, z)
    a.heading = heading
    this.debugActors.push(a)
    return a
  }

  *allActors(): Iterable<Actor> {
    yield this.player.actor
    yield* this.debugActors
    yield* this.peds.actors()
    yield* this.police.actors()
    yield* this.missions.actors()
  }

  spawnVehicle(
    specId: string,
    x: number,
    y: number,
    z: number,
    heading: number,
    mode: 'kinematic' | 'dynamic',
    color?: string,
  ) {
    // Un véhicule physique naît sur la surface réelle (dalle, tremplin, parking) et non dedans : posé au-dessus
    // du premier sol trouvé un peu plus haut que le point demandé.
    if (mode === 'dynamic') {
      const ground = this.physics.raycast(x, y + 2.5, z, 0, -1, 0, 5, SPAWN_GROUND)
      // Un rayon qui part de l'intérieur d'un obstacle (distance nulle) ne dit rien du sol.
      if (ground && ground.distance > 0) y = Math.max(y, ground.y + 0.15)
    }
    const v = new Vehicle(this, specId, x, y, z, heading, mode, color)
    this.vehicles.add(v)
    return v
  }

  removeVehicle(v: Vehicle) {
    if (!this.vehicles.has(v)) return
    if (v === this.player.vehicle) return
    this.vehicles.delete(v)
    if (v.driver && v.driver !== this.player.actor) this.peds.disposeSeated(v.driver)
    for (const p of v.passengers) this.peds.disposeSeated(p)
    v.dispose()
  }

  /** Fixed-step simulation. */
  update(dt: number) {
    if (this.disposed) return
    this.time += dt
    sharedUniforms.uTime.value = this.time
    this.player.update(dt)
    this.combat.updatePlayer(dt)
    if (!this.debug.freezeTraffic) this.traffic.update(dt)
    this.peds.update(dt)
    this.police.update(dt)
    this.missions.update(dt)
    for (const v of this.vehicles) {
      if (v.driverAI instanceof DriverAI) v.driverAI.update(v, dt)
      v.update(dt)
    }
    this.combat.update(dt)

    this.physics.step()
    this.processPhysicsEvents()

    this.player.postStep()
    for (const v of this.vehicles) v.postStep(dt)
    this.peds.postStep()
    this.police.postStep()
    this.missions.postStep()
    this.pickups.update(dt)
    this.interactions.update()
  }

  private processPhysicsEvents() {
    const ph = this.physics
    ph.events.drainContactForceEvents((e) => {
      const c1 = ph.world.getCollider(e.collider1())
      const c2 = ph.world.getCollider(e.collider2())
      const o1 = ph.ownerOf(c1)
      const o2 = ph.ownerOf(c2)
      const force = e.totalForceMagnitude()
      const dir = e.maxForceDirection()
      for (const [a, b] of [
        [o1, o2],
        [o2, o1],
      ] as const) {
        if (a?.kind === 'prop' && (b?.kind === 'vehicle' || b?.kind === 'debris')) {
          const s = b.kind === 'vehicle' ? Math.min(3, Math.abs((b.ref as Vehicle).speed) / 8) : 1
          this.world.destroyProp(a.id, { x: -dir.x * 200 * s, y: 150, z: -dir.z * 200 * s })
        }
        if (a?.kind === 'vehicle') {
          const v = a.ref as Vehicle
          const thr = v.spec.mass * 9.81 * 18
          if (force > thr && b?.kind !== 'prop')
            v.damage(
              (force - thr) / (v.spec.mass * 3.2),
              b?.kind === 'vehicle' ? ((b.ref as Vehicle).driver ?? null) : null,
            )
          if (b?.kind === 'vehicle' && v.mode === 'kinematic') this.traffic.onBumped(v, b.ref as Vehicle)
        }
      }
    })
    ph.events.drainCollisionEvents((h1, h2, started) => {
      if (!started) return
      const o1 = ph.ownerOf(ph.world.getCollider(h1))
      const o2 = ph.ownerOf(ph.world.getCollider(h2))
      if (o1?.kind === 'vehicle' && o2?.kind === 'vehicle') {
        const a = o1.ref as Vehicle
        const b = o2.ref as Vehicle
        if (a.mode === 'kinematic' && b.mode === 'dynamic') this.traffic.onBumped(a, b)
        if (b.mode === 'kinematic' && a.mode === 'dynamic') this.traffic.onBumped(b, a)
        if (a.playerDriven || b.playerDriven) this.events.emit('vehicle:attacked', { vehicle: a.playerDriven ? b : a })
      }
    })
  }

  /** Per rendered frame. */
  render(alpha: number, frameDt: number) {
    if (this.disposed) return
    this.frame++
    const night = this.env.night
    for (const v of this.vehicles) v.render(alpha, frameDt, night)
    this.cameraCtl.update(frameDt, alpha)
    const pv = this.player.vehicle
    if (pv && !pv.destroyed && (pv.spec.kind === 'car' || pv.spec.kind === 'bike') && night > 0.1) {
      const f = pv.forward(new Vector3())
      const r = pv.visual.root
      this.headlight.position
        .copy(r.position)
        .addScaledVector(f, pv.spec.length / 2)
        .setY(r.position.y + pv.spec.belt)
      this.headlight.target.position.copy(this.headlight.position).addScaledVector(f, 20).setY(r.position.y)
      this.headlight.intensity = night * 800
    } else this.headlight.intensity = 0
    this.camPos.copy(this.camera.position)
    for (const a of this.allActors()) a.render(alpha, frameDt, this.camPos)
    this.combat.render()
    this.env.update(frameDt, frameDt, this.player.position, this.camPos)
    this.world.update(frameDt, this.camPos, this.player.position, night)
    this.effects.update(frameDt)
    this.reflections.update(this.renderer, this.scene, this.player.position.clone().setY(this.player.position.y + 2.5))
    this.vehicleEffects(frameDt)
    this.pickups.render(frameDt)
    this.missions.render(frameDt)
    this.hudTimer -= frameDt
    if (this.hudTimer <= 0) {
      this.hudTimer = 1 / 15
      publishHud(this)
    }
    if (input.wasPressedThisFrame('F5')) void saveGame(this)
  }

  private smokeTimer = 0
  private vehicleEffects(dt: number) {
    this.smokeTimer -= dt
    if (this.smokeTimer > 0) return
    this.smokeTimer = 0.08
    for (const v of this.vehicles) {
      if (v.position.distanceTo(this.camPos) > 150) continue
      const ratio = v.health / v.spec.health
      if (ratio > 0.4 && !v.destroyed) continue
      const p = v.position.clone()
      p.y += v.spec.belt + 0.2
      const fwd = v.forward(new Vector3())
      p.addScaledVector(fwd, v.spec.length * 0.32)
      if (v.destroyed) {
        this.effects.smoke(p, true, 1.5)
        if (Math.random() < 0.5) this.effects.fire(p, 1.2)
      } else {
        this.effects.smoke(p, ratio < 0.2)
        if (v.burnTimer >= 0) this.effects.fire(p)
      }
    }
  }

  /** Respawn after death or arrest. */
  respawn(reason: 'dead' | 'busted') {
    const loc = reason === 'dead' ? this.city.locations.hospital : this.city.locations.policeStation
    // Les frais sont calculés par le serveur.
    useGameStore
      .getState()
      .respawn(reason)
      .then((fee) => {
        this.events.emit('notify', {
          text: `${reason === 'dead' ? 'Frais d’hôpital' : 'Caution'} : -${formatMoney(fee)}`,
          kind: 'fail',
        })
      })
      .catch((err: Error) => this.events.emit('notify', { text: err.message, kind: 'fail' }))
    this.police.clear()
    this.missions.fail(reason === 'dead' ? 'Tu es mort' : 'Tu as été arrêté')
    if (reason === 'busted') {
      // Arrested: lose weapons except fists.
      this.player.inventory.weapons = this.player.inventory.weapons.filter((w) => w.id === 'fists')
      this.player.inventory.current = 'fists'
      this.player.actor.setWeapon('fists')
    }
    this.player.respawnAt(loc.x, loc.y, loc.z)
    this.player.actor.armor = 0
    this.events.emit('player:respawned', {})
  }

  dispose() {
    this.disposed = true
    this.combat.dispose()
    this.missions.dispose()
    this.police.dispose()
    this.peds.dispose()
    this.traffic.dispose()
    for (const v of [...this.vehicles]) v.dispose()
    this.vehicles.clear()
    this.player.actor.dispose()
    this.world.dispose()
    this.env.dispose()
    this.reflections.dispose()
    this.root.removeFromParent()
    this.events.clear()
    this.physics.dispose()
  }
}
