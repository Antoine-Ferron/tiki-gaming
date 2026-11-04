import { AdditiveBlending, Color, CylinderGeometry, Mesh, MeshBasicMaterial, Vector3 } from 'three'
import { Rng } from '../../core/rng'
import { randomLook } from '../../procgen/character/characterModel'
import { Actor } from '../../entities/Actor'
import { CombatNpc } from '../../entities/CombatNpc'
import type { Vehicle } from '../../entities/Vehicle'
import type { Game } from '../../game/Game'
import { useGameStore } from '../../state/gameStore'
import { saveGame } from '../../state/save'
import { DriverAI } from '../DriverAI'
import { MissionRunner, type FailRule, type MissionContext, type Pos, type Step } from './runner'
import { formatMoney } from '../../domain/format'

export interface MissionDef {
  id: string
  title: string
  brief: string
  reward: number
  giver: Pos
  steps: Step[]
}

/** Comportements client d'une mission (apparitions, règles d'échec temps réel), par identifiant. */
interface MissionHooks {
  failRules?(game: Game, m: Missions): FailRule[]
  onStep?(game: Game, m: Missions, index: number, step: Step): void
  setup?(game: Game, m: Missions): void
}

const markerGeo = new CylinderGeometry(1, 1, 1, 24, 1, true)

function marker(color: string) {
  const m = new Mesh(
    markerGeo,
    new MeshBasicMaterial({
      color: new Color(color).multiplyScalar(2),
      transparent: true,
      opacity: 0.35,
      blending: AdditiveBlending,
      depthWrite: false,
    }),
  )
  m.frustumCulled = false
  return m
}

/**
 * Le catalogue (textes, étapes, récompenses, donneurs) vient du backend (`GET /api/missions`).
 * Le client n'ajoute que ce qui dépend du moteur : apparition des entités et règles d'échec.
 */
const HOOKS: Record<string, MissionHooks> = {
  chase: {
    setup: (game, m) => {
      const p = game.player.position
      const hit = game.nav.edgesInRing(p.x, p.z, 50, 90)[0]
      if (!hit) return
      const pt = game.city.roads.graph.lanePoint(hit, 1, 0, hit.length / 2)
      const d = game.city.roads.graph.direction(hit, 1)
      const v = game.spawnVehicle('sport', pt.x, pt.y + 0.4, pt.z, Math.atan2(d.x, d.z), 'dynamic', '#c0392b')
      v.tags.add('target')
      v.persistent = true
      const driver = m.spawnSeated(v, 'target')
      driver.maxHealth = driver.health = 80
      const ai = new DriverAI(game, 'flee', () => game.player.position)
      ai.maxSpeed = 26
      v.driverAI = ai
      m.track(v)
    },
    failRules: (game, m) => [
      {
        reason: 'La cible s’est échappée',
        check: () => {
          const t = m.tagged('target')
          return !!t && t.position.distanceTo(game.player.position) > 380
        },
      },
    ],
  },
  port: {
    setup: (game, m) => {
      const door = game.city.locations.warehouseDoor
      const inside = game.city.locations.warehouseInside
      m.spawnGuard(inside.x, inside.z, 'boss', 'rifle', 200)
      const rng = new Rng(55)
      for (let i = 0; i < 5; i++) {
        const inDoor = i < 2
        const x = inDoor ? inside.x + rng.range(-8, 8) : door.x + rng.range(-12, 12)
        const z = inDoor ? inside.z + rng.range(-6, 6) : door.z + rng.range(-12, 12)
        m.spawnGuard(x, z, 'guard', i % 2 ? 'pistol' : 'shotgun', 90)
      }
    },
    onStep: (game, _m, index) => {
      if (index === 2) game.police.wanted.setMinimum(2, game.player.position.x, game.player.position.z)
    },
  },
  special: {
    setup: (game, m) => {
      const special = game.city.locations.missionPoints[2]
      const v = game.spawnVehicle(
        'sport',
        special.x,
        special.y + 0.3,
        special.z,
        special.heading ?? 0,
        'dynamic',
        '#d4af37',
      )
      v.tags.add('special')
      v.persistent = true
      m.track(v)
    },
    onStep: (game, _m, index) => {
      if (index === 1) game.police.wanted.setMinimum(2, game.player.position.x, game.player.position.z)
    },
    failRules: (_game, m) => [
      {
        reason: 'La voiture est trop abîmée',
        check: () => {
          const v = m.tagged('special') as Vehicle | undefined
          return !!v && v.health < v.spec.health * 0.3
        },
      },
    ],
  },
}

/** Mission givers, active mission, objective markers and GPS target. */
export class Missions {
  readonly defs: MissionDef[]
  active: { def: MissionDef; runner: MissionRunner } | null = null
  private giverMarkers: Mesh[] = []
  private objectiveMarker: Mesh
  private npcs: CombatNpc[] = []
  private vehicles: Vehicle[] = []
  private rng = new Rng(31)
  private endTimer = 0

  constructor(
    private game: Game,
    defs: MissionDef[],
  ) {
    this.defs = defs
    for (const d of this.defs) {
      const m = marker('#ffd23f')
      m.scale.set(1.2, 2.5, 1.2)
      m.position.set(d.giver.x, game.city.terrain.heightAt(d.giver.x, d.giver.z) + 1.4, d.giver.z)
      game.root.add(m)
      this.giverMarkers.push(m)
    }
    this.objectiveMarker = marker('#ffd23f')
    this.objectiveMarker.visible = false
    game.root.add(this.objectiveMarker)
    game.events.on('actor:killed', ({ actor }) => {
      if (actor.tags.has('target') || actor.tags.has('boss'))
        game.events.emit('notify', { text: 'Cible éliminée', kind: 'success' })
    })
  }

  get completed() {
    return useGameStore.getState().completedMissions
  }

  available(): MissionDef[] {
    return this.defs.filter((d) => !this.completed.includes(d.id))
  }

  /** Giver close to the player (for the interaction prompt). */
  giverNear(pos: Vector3): MissionDef | undefined {
    if (this.active) return undefined
    return this.available().find((d) => Math.hypot(d.giver.x - pos.x, d.giver.z - pos.z) < 3)
  }

  *actors(): Iterable<Actor> {
    for (const n of this.npcs) yield n.actor
  }

  track(v: Vehicle) {
    this.vehicles.push(v)
  }

  spawnSeated(v: Vehicle, tag: string): Actor {
    const a = new Actor(this.game, randomLook(this.rng), 'gang', v.position.x, v.position.y, v.position.z)
    a.tags.add(tag)
    a.seatedIn = v
    a.anim.seated = true
    v.visual.tilt.add(a.rig.object)
    a.rig.object.position.copy(v.visual.seat)
    v.driver = a
    this.game.peds.adoptSeated(a)
    return a
  }

  spawnGuard(x: number, z: number, tag: string, weapon: 'pistol' | 'rifle' | 'shotgun', health: number) {
    const y = this.game.city.terrain.heightAt(x, z) + 0.2
    const look = randomLook(this.rng)
    look.shirt = new Color(tag === 'boss' ? '#f5f5f5' : '#3b3b3b')
    look.pants = new Color('#1a1a1a')
    const a = new Actor(this.game, look, 'gang', x, y, z)
    a.tags.add(tag)
    a.maxHealth = a.health = health
    if (tag === 'boss') a.armor = 50
    const npc = new CombatNpc(this.game, a, weapon)
    npc.mode = 'guard'
    npc.post = new Vector3(x, y, z)
    npc.accuracy = tag === 'boss' ? 0.55 : 0.4
    npc.sight = 45
    this.npcs.push(npc)
    // Guards react when the player shoots nearby.
    return npc
  }

  /** First entity carrying a tag (actor or vehicle) that is still alive. */
  tagged(tag: string): Actor | Vehicle | undefined {
    for (const v of this.vehicles) if (v.tags.has(tag) && !v.destroyed) return v
    for (const a of this.game.allActors()) if (a.tags.has(tag) && !a.dead) return a
    return undefined
  }

  private context(): MissionContext {
    const game = this.game
    return {
      playerPos: () => game.player.position,
      inVehicle: () => !!game.player.vehicle,
      vehicleTag: () => {
        const v = game.player.vehicle
        return v ? ([...v.tags][0] ?? null) : null
      },
      alive: (tag) => {
        const t = this.tagged(tag)
        if (!t) return false
        // A vehicle whose tagged driver died no longer counts (chase target).
        if ('spec' in t && tag === 'target') {
          const d = (t as Vehicle).driver
          return !!d && !d.dead
        }
        return true
      },
      wanted: () => game.police.wanted.stars,
    }
  }

  start(def: MissionDef) {
    if (this.active) return
    // Les entités d'une tentative précédente (cible encore en vie, voiture abîmée) ne doivent pas compter.
    this.cleanup(true)
    const game = this.game
    const hooks = HOOKS[def.id] ?? {}
    hooks.setup?.(game, this)
    const runner = new MissionRunner(def.steps, hooks.failRules?.(game, this) ?? [], (i, s) => {
      hooks.onStep?.(game, this, i, s)
      if (i > 0) game.events.emit('notify', { text: s.text, kind: 'info' })
    })
    this.active = { def, runner }
    game.events.emit('notify', { text: def.title, kind: 'big' })
    game.events.emit('notify', { text: def.brief, kind: 'info' })
  }

  fail(reason: string) {
    if (!this.active) return
    this.active.runner.fail(reason)
    this.finish()
  }

  private finish() {
    const a = this.active
    if (!a) return
    const game = this.game
    if (a.runner.status === 'success') {
      // Le serveur vérifie la mission et paie la récompense de son catalogue.
      useGameStore
        .getState()
        .completeMission(a.def.id)
        .then((reward) => {
          game.events.emit('notify', { text: `MISSION RÉUSSIE  +${formatMoney(reward)}`, kind: 'success' })
          void saveGame(game) // saveGame signale lui-même ses erreurs
          if (this.available().length === 0)
            game.events.emit('notify', {
              text: 'Toutes les missions sont terminées. La ville est à toi.',
              kind: 'info',
            })
        })
        .catch((err: Error) => game.events.emit('notify', { text: err.message, kind: 'fail' }))
    } else {
      game.events.emit('notify', { text: `MISSION ÉCHOUÉE — ${a.runner.failReason}`, kind: 'fail' })
    }
    this.active = null
    this.endTimer = 20
  }

  /** Remove mission entities once the player is away. */
  private cleanup(force = false) {
    const p = this.game.player.position
    for (let i = this.npcs.length - 1; i >= 0; i--) {
      if (force || this.npcs[i].actor.position.distanceTo(p) > 120) {
        this.npcs[i].dispose()
        this.npcs.splice(i, 1)
      }
    }
    for (let i = this.vehicles.length - 1; i >= 0; i--) {
      const v = this.vehicles[i]
      if (v === this.game.player.vehicle) {
        v.tags.clear()
        v.persistent = false
        this.vehicles.splice(i, 1)
        continue
      }
      if (force || v.position.distanceTo(p) > 150) {
        this.game.removeVehicle(v)
        this.vehicles.splice(i, 1)
      }
    }
  }

  update(dt: number) {
    const game = this.game
    if (this.active) {
      const status = this.active.runner.update(dt, this.context())
      if (status !== 'running') this.finish()
    } else if (this.endTimer > 0) {
      this.endTimer -= dt
      if (this.endTimer <= 0) this.cleanup()
    }
    for (const n of this.npcs) {
      // Guards wake up when the player is close or noisy.
      if (n.mode === 'guard' && n.actor.position.distanceTo(game.player.position) < 25) n.mode = 'chase'
      n.update(dt)
    }
  }

  postStep() {
    for (const n of this.npcs) if (!n.actor.dead) n.postStep()
  }

  /** Current objective position (marker + GPS). */
  objective(): Vector3 | null {
    const a = this.active
    if (!a) return null
    const s = a.runner.step
    if (!s) return null
    if (s.type === 'goto' || s.type === 'deliver')
      return new Vector3(s.pos.x, this.game.city.terrain.heightAt(s.pos.x, s.pos.z), s.pos.z)
    if (s.type === 'enterVehicle' || s.type === 'destroy') return this.tagged(s.tag)?.position.clone() ?? null
    if (s.type === 'eliminate') {
      for (const t of s.tags) {
        const e = this.tagged(t)
        if (e) return e.position.clone()
      }
    }
    return null
  }

  hud() {
    const a = this.active
    if (!a) return null
    return { title: a.def.title, objective: a.runner.step?.text ?? '', timer: a.runner.timeLeft }
  }

  render(dt: number) {
    const avail = this.available()
    this.defs.forEach((d, i) => {
      const m = this.giverMarkers[i]
      m.visible = !this.active && avail.includes(d)
      m.rotation.y += dt
    })
    const obj = this.objective()
    const step = this.active?.runner.step
    const show = !!obj && (step?.type === 'goto' || step?.type === 'deliver')
    this.objectiveMarker.visible = show
    if (show && obj && step && 'radius' in step) {
      this.objectiveMarker.position.set(obj.x, obj.y + 1.5, obj.z)
      this.objectiveMarker.scale.set(step.radius, 3, step.radius)
    }
  }

  dispose() {
    this.cleanup(true)
    this.giverMarkers.forEach((m) => m.removeFromParent())
    this.objectiveMarker.removeFromParent()
  }
}
