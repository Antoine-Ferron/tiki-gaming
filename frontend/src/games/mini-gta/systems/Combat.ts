import { Mesh, SphereGeometry, Vector3 } from 'three'
import { input } from '../core/input'
import { Ball, ColliderDesc, Groups, groups, Layer, type RigidBody, RigidBodyDesc } from '../physics/physics'
import { propMaterial } from '../render/materials'
import type { Actor } from '../entities/Actor'
import type { Vehicle } from '../entities/Vehicle'
import type { Game } from '../game/Game'
import {
  WEAPONS,
  WEAPON_ORDER,
  consumeShot,
  cycleWeapon,
  reload,
  slotOf,
  type WeaponDef,
  type WeaponId,
} from './weapons'
import { Bloom, damageFalloff, hitZone, recoilKick, shotSpread, zoneMultiplier } from './ballistics'

interface Grenade {
  body: RigidBody
  mesh: Mesh
  fuse: number
  owner: Actor | null
}

const _o = new Vector3()
const _d = new Vector3()
const _p = new Vector3()
const _n = new Vector3()
const grenadeGeo = new SphereGeometry(0.09, 8, 6)

export class Combat {
  private cooldown = 0
  private reloading = 0
  private grenades: Grenade[] = []
  private firedTimer = 0
  private attackAnim = 0
  /** Accumulated recoil kick (rad) applied to the camera. */
  recoil = 0
  /** Recul horizontal accumulé (rad). */
  recoilYaw = 0
  /** Dispersion accumulée par les tirs rapprochés du joueur. */
  readonly bloom = new Bloom()
  /** Tirs rapprochés consécutifs (le recul d'une rafale s'accentue). */
  private burstShots = 0
  private sinceShot = 99
  /** Dernière touche du joueur, pour le marqueur du HUD (horodatage `performance.now()`). */
  hitMarker: { at: number; kill: boolean } | null = null

  constructor(private game: Game) {}

  get recentlyFired() {
    return this.firedTimer > 0
  }

  get isReloading() {
    return this.reloading > 0
  }

  /** Player weapon input (switching, firing, reloading). Fixed step. */
  updatePlayer(dt: number) {
    const game = this.game
    const player = game.player
    this.cooldown -= dt
    this.firedTimer -= dt
    const a = player.actor
    if (this.attackAnim > 0) {
      this.attackAnim += dt * 3
      a.anim.attack = this.attackAnim
      if (this.attackAnim >= 1) {
        this.attackAnim = 0
        a.anim.attack = 0
      }
    }
    const inv = player.inventory
    a.tickReactions(dt)
    this.sinceShot += dt
    this.bloom.recover(WEAPONS[inv.current], dt)
    if (this.sinceShot > WEAPONS[inv.current].interval * 2.5) this.burstShots = 0
    if (this.reloading > 0) {
      this.reloading -= dt
      if (this.reloading <= 0) reload(inv)
    }
    if (!player.alive || game.ui.blocking) return
    const inVehicle = player.state === 'vehicle'

    // Weapon selection
    const wheel = input.consumeWheel()
    if (wheel && !inVehicle) this.select(cycleWeapon(inv, wheel > 0 ? 1 : -1))
    for (let k = 1; k <= 7; k++) {
      if (input.wasPressed(`Digit${k}`)) {
        const id = WEAPON_ORDER[k - 1]
        if (slotOf(inv, id)) this.select(id)
      }
    }
    const def = WEAPONS[inv.current]
    if (a.weapon !== inv.current) a.setWeapon(inv.current)
    if (input.wasPressed('KeyR')) this.startReload()

    const trigger = (input.buttons & 1) !== 0
    const pressed = trigger && (def.auto || !this.triggerHeld)
    this.triggerHeld = trigger
    if (!pressed || this.cooldown > 0 || this.reloading > 0) return
    if (inVehicle) {
      // Drive-by: pistol only, while aiming.
      if (!player.aiming || def.id !== 'pistol') return
    }
    if (def.melee) {
      this.cooldown = def.interval
      this.attackAnim = 0.001
      this.melee(a, def)
      return
    }
    if (!consumeShot(inv)) {
      this.startReload()
      return
    }
    this.cooldown = def.interval
    this.firedTimer = 1.2
    if (def.thrown) {
      this.attackAnim = 0.001
      this.throwGrenade(a)
      if ((slotOf(inv, 'grenade')?.ammo ?? 0) <= 0) this.select('fists')
      return
    }
    const ray = game.cameraCtl.aimRay()
    // Start the ray near the player so nothing between camera and player is hit.
    const chest = a.chest(_p)
    const t = Math.max(0, chest.clone().sub(ray.o).dot(ray.d))
    _o.copy(ray.o).addScaledVector(ray.d, t)
    const spread = shotSpread(
      def,
      {
        aiming: player.aiming,
        crouching: a.anim.crouch,
        moving: a.anim.speed > 1,
        sprinting: a.anim.speed > 5,
        airborne: !a.anim.grounded,
      },
      this.bloom.value,
    )
    const muzzle = a
      .chest(new Vector3())
      .add(new Vector3(Math.sin(a.heading), 0.1, Math.cos(a.heading)).multiplyScalar(0.6))
    for (let k = 0; k < def.pellets; k++) {
      _d.copy(ray.d)
      _d.x += (Math.random() - 0.5) * 2 * spread
      _d.y += (Math.random() - 0.5) * 2 * spread
      _d.z += (Math.random() - 0.5) * 2 * spread
      _d.normalize()
      this.hitscan(_o, _d, def, a, muzzle, player.vehicle?.body ?? player.body.body)
    }
    game.effects.muzzle(muzzle, ray.d)
    const kick = recoilKick(def, this.burstShots++)
    this.recoil += kick.pitch
    this.recoilYaw += kick.yaw
    this.bloom.fire(def)
    this.sinceShot = 0
    game.events.emit('noise', { x: a.position.x, y: a.position.y, z: a.position.z, radius: def.noise, source: a })
    if (slotOf(inv, inv.current)!.clip === 0) this.startReload()
  }

  private triggerHeld = false

  select(id: WeaponId) {
    const inv = this.game.player.inventory
    inv.current = id
    this.reloading = 0
    this.game.player.actor.setWeapon(id)
  }

  private startReload() {
    const inv = this.game.player.inventory
    const def = WEAPONS[inv.current]
    const slot = slotOf(inv, inv.current)
    if (!slot || def.melee || def.thrown || this.reloading > 0) return
    if (slot.clip >= def.magazine || slot.ammo <= 0) return
    this.reloading = def.reload
  }

  /** Cast a bullet and apply its effects. Returns the hit point. */
  hitscan(
    origin: Vector3,
    dir: Vector3,
    def: WeaponDef,
    shooter: Actor | null,
    muzzle: Vector3,
    exclude?: RigidBody,
    damageScale = 1,
  ) {
    const game = this.game
    const hit = game.physics.raycast(
      origin.x,
      origin.y,
      origin.z,
      dir.x,
      dir.y,
      dir.z,
      def.range,
      groups(0xffff, 0xffff & ~Layer.Sensor),
      exclude,
    )
    const end = hit ? _p.set(hit.x, hit.y, hit.z) : _p.copy(origin).addScaledVector(dir, def.range)
    game.effects.tracer(muzzle, end)
    if (!hit) return null
    _n.set(hit.nx, hit.ny, hit.nz)
    const owner = game.physics.ownerOf(hit.collider)
    const dmg = def.damage * damageScale * damageFalloff(def, hit.distance)
    if (owner?.kind === 'character') {
      const target = owner.ref as Actor
      // Zone touchée : hauteur au-dessus des pieds et écart latéral à l'axe du corps (vu du tireur).
      const dx = hit.x - target.position.x
      const dz = hit.z - target.position.z
      const zone = hitZone(hit.y - target.position.y, dx * -dir.z + dz * dir.x, target.anim.crouch)
      const isPlayer = target === game.player.actor
      // Le joueur encaisse moins à la tête : les PNJ ne doivent pas le tuer d'une balle.
      const mult = isPlayer ? Math.min(1.8, zoneMultiplier(zone, def)) : zoneMultiplier(zone, def)
      const killed = target.damage({
        amount: dmg * mult,
        from: shooter,
        kind: 'bullet',
        dir: { x: dir.x, z: dir.z },
        zone,
        push: (def.damage * def.pellets) / 45,
      })
      game.effects.impact(end, _n, 'blood')
      if (isPlayer) game.cameraCtl.addShake(0.12)
      if (shooter === game.player.actor) this.hitMarker = { at: performance.now(), kill: killed || target.dead }
    } else if (owner?.kind === 'vehicle') {
      const v = owner.ref as Vehicle
      v.lastAttacker = shooter
      v.damage(dmg * 0.6, shooter)
      game.effects.impact(end, _n, 'spark')
      if (v.mode === 'dynamic')
        v.body.applyImpulseAtPoint(
          { x: dir.x * dmg * 2, y: 0, z: dir.z * dmg * 2 },
          { x: hit.x, y: hit.y, z: hit.z },
          true,
        )
    } else if (owner?.kind === 'prop') {
      const prop = game.city.props[owner.id]
      if (prop && (prop.kind === 'hydrant' || prop.kind === 'bin'))
        game.world.destroyProp(owner.id, { x: dir.x * 60, y: 20, z: dir.z * 60 })
      game.effects.impact(end, _n, 'spark')
    } else {
      const body = hit.collider.parent()
      if (body && body.isDynamic())
        body.applyImpulseAtPoint(
          { x: dir.x * dmg, y: dir.y * dmg, z: dir.z * dmg },
          { x: hit.x, y: hit.y, z: hit.z },
          true,
        )
      game.effects.impact(end, _n, hit.ny > 0.7 ? 'dust' : 'spark')
    }
    return end.clone()
  }

  /** NPC shot at a target point with an accuracy (0..1). */
  npcFire(shooter: Actor, target: Vector3, accuracy: number, weapon: WeaponId = 'pistol', exclude?: RigidBody) {
    const def = WEAPONS[weapon]
    const from = shooter.chest(new Vector3())
    from.y += 0.1
    const dir = target.clone().sub(from)
    const dist = dir.length()
    dir.divideScalar(dist)
    const miss = (1 - accuracy) * 0.12 + def.spread
    from.addScaledVector(dir, 0.6)
    for (let k = 0; k < def.pellets; k++) {
      _d.copy(dir)
      _d.x += (Math.random() - 0.5) * 2 * miss
      _d.y += (Math.random() - 0.5) * 2 * miss
      _d.z += (Math.random() - 0.5) * 2 * miss
      _d.normalize()
      this.hitscan(from, _d, def, shooter, from, exclude, 0.55)
    }
    this.game.effects.muzzle(from, dir)
    this.game.events.emit('noise', { x: from.x, y: from.y, z: from.z, radius: def.noise * 0.7, source: shooter })
  }

  /** Short-range strike in front of the attacker. */
  melee(attacker: Actor, def: WeaponDef) {
    const game = this.game
    const h = attacker.heading
    const c = attacker.chest(new Vector3()).add(new Vector3(Math.sin(h), -0.2, Math.cos(h)).multiplyScalar(0.9))
    const shape = new Ball(0.75)
    const hitActors = new Set<Actor>()
    game.physics.world.intersectionsWithShape(
      c,
      { x: 0, y: 0, z: 0, w: 1 },
      shape,
      (col) => {
        const owner = game.physics.ownerOf(col)
        if (owner?.kind === 'character' && owner.ref !== attacker) hitActors.add(owner.ref as Actor)
        if (owner?.kind === 'vehicle') (owner.ref as Vehicle).damage(def.damage * 0.3, attacker)
        if (owner?.kind === 'prop' && def.id === 'bat')
          game.world.destroyProp(owner.id, { x: Math.sin(h) * 40, y: 10, z: Math.cos(h) * 40 })
        return true
      },
      undefined,
      Groups.rayAll,
    )
    for (const t of hitActors) {
      t.damage({
        amount: def.damage,
        from: attacker,
        kind: 'melee',
        dir: { x: Math.sin(h), z: Math.cos(h) },
        push: def.id === 'bat' ? 2.5 : 1,
      })
      game.effects.impact(t.chest(new Vector3()), new Vector3(-Math.sin(h), 0, -Math.cos(h)), 'blood')
    }
    if (hitActors.size) game.events.emit('noise', { x: c.x, y: c.y, z: c.z, radius: 15, source: attacker })
  }

  throwGrenade(thrower: Actor) {
    const game = this.game
    const ray = game.cameraCtl.aimRay()
    const from = thrower.chest(new Vector3()).add(new Vector3(0, 0.4, 0))
    const vel = ray.d
      .clone()
      .multiplyScalar(17)
      .add(new Vector3(0, 4.5, 0))
    const body = game.physics.world.createRigidBody(
      RigidBodyDesc.dynamic()
        .setTranslation(from.x, from.y, from.z)
        .setLinvel(vel.x, vel.y, vel.z)
        .setCcdEnabled(true)
        .setAngularDamping(1),
    )
    const col = game.physics.world.createCollider(
      ColliderDesc.ball(0.09).setMass(0.4).setRestitution(0.4).setFriction(0.8).setCollisionGroups(Groups.projectile),
      body,
    )
    game.physics.setOwner(col, { kind: 'debris', ref: null })
    const mesh = new Mesh(grenadeGeo, propMaterial)
    mesh.castShadow = true
    game.root.add(mesh)
    this.grenades.push({ body, mesh, fuse: 2.6, owner: thrower })
  }

  /** Radial damage, impulses and chain reactions. */
  explosion(x: number, y: number, z: number, radius: number, damage: number, attacker: Actor | null) {
    const game = this.game
    const center = new Vector3(x, y, z)
    game.effects.explosion(center, radius)
    const dCam = game.camera.position.distanceTo(center)
    game.cameraCtl.addShake(Math.max(0, 1.2 - dCam / 60))
    game.events.emit('noise', { x, y, z, radius: 180, source: attacker })
    for (const actor of game.allActors()) {
      if (actor.dead) continue
      const d = actor.position.distanceTo(center)
      if (d > radius) continue
      const k = 1 - d / radius
      const dir = actor.position.clone().sub(center).setY(0).normalize()
      actor.damage({
        amount: damage * k * (actor.seatedIn ? 0.6 : 1),
        from: attacker,
        kind: 'explosion',
        dir: { x: dir.x, z: dir.z },
        push: 8 * k,
      })
    }
    for (const v of game.vehicles) {
      const d = v.position.distanceTo(center)
      if (d > radius * 1.4 || d < 0.01) continue
      const k = 1 - d / (radius * 1.4)
      v.lastAttacker = attacker
      if (v.mode === 'kinematic' && k > 0.2) v.makeDynamic()
      v.damage(damage * 8 * k, attacker)
      if (v.mode === 'dynamic') {
        const dir = v.position.clone().sub(center).normalize()
        const imp = v.spec.mass * 9 * k
        v.body.applyImpulse({ x: dir.x * imp, y: Math.abs(dir.y) * imp + imp * 0.5, z: dir.z * imp }, true)
      }
    }
    // Props and loose bodies
    game.physics.world.intersectionsWithShape(center, { x: 0, y: 0, z: 0, w: 1 }, new Ball(radius * 0.7), (col) => {
      const owner = game.physics.ownerOf(col)
      if (owner?.kind === 'prop') {
        const p = game.city.props[owner.id]
        const dir = new Vector3(p.x - x, 0, p.z - z).normalize()
        game.world.destroyProp(owner.id, { x: dir.x * 400, y: 300, z: dir.z * 400 })
      } else if (owner?.kind === 'debris') {
        const b = col.parent()
        if (b?.isDynamic()) {
          const t = b.translation()
          const dir = new Vector3(t.x - x, t.y - y + 1, t.z - z).normalize()
          b.applyImpulse({ x: dir.x * 300, y: dir.y * 300, z: dir.z * 300 }, true)
        }
      }
      return true
    })
  }

  update(dt: number) {
    for (let i = this.grenades.length - 1; i >= 0; i--) {
      const g = this.grenades[i]
      g.fuse -= dt
      if (g.fuse <= 0) {
        const t = g.body.translation()
        this.game.physics.removeBody(g.body)
        g.mesh.removeFromParent()
        this.grenades.splice(i, 1)
        this.explosion(t.x, t.y + 0.3, t.z, 8, 220, g.owner)
      }
    }
  }

  render() {
    for (const g of this.grenades) {
      const t = g.body.translation()
      const r = g.body.rotation()
      g.mesh.position.set(t.x, t.y, t.z)
      g.mesh.quaternion.set(r.x, r.y, r.z, r.w)
    }
    // Le recul relève la visée (et la décale un peu) ; au joueur de la ramener.
    if (this.recoil > 0 || this.recoilYaw !== 0) {
      this.game.cameraCtl.pitch -= this.recoil * 0.5
      this.game.cameraCtl.yaw += this.recoilYaw * 0.5
      this.recoil *= 0.5
      this.recoilYaw *= 0.5
      if (this.recoil < 0.001) this.recoil = 0
      if (Math.abs(this.recoilYaw) < 0.0005) this.recoilYaw = 0
    }
  }

  dispose() {
    for (const g of this.grenades) {
      this.game.physics.removeBody(g.body)
      g.mesh.removeFromParent()
    }
    this.grenades = []
  }
}
