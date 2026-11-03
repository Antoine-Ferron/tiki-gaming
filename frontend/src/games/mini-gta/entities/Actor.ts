import { Vector3, type Mesh } from 'three'
import { CharacterAnimator, defaultAnimState, type AnimState } from '../procgen/character/animator'
import {
  buildCharacter,
  disposeCharacter,
  type CharacterLook,
  type CharacterRig,
} from '../procgen/character/characterModel'
import { buildWeaponMesh } from '../procgen/weapons/weaponModel'
import { WEAPONS, type WeaponId } from '../systems/weapons'
import { Interp } from '../game/Interp'
import type { Game } from '../game/Game'

export type Faction = 'player' | 'civilian' | 'police' | 'gang'

export interface DamageInfo {
  amount: number
  from?: Actor | null
  kind: 'bullet' | 'melee' | 'explosion' | 'vehicle' | 'fall' | 'fire' | 'drown'
  /** Impact direction (for knockback / death fall). */
  dir?: { x: number; z: number }
}

let nextId = 1

/** A humanoid in the world: visual rig, procedural animation, health and held weapon. */
export class Actor {
  readonly id = nextId++
  readonly rig: CharacterRig
  readonly animator: CharacterAnimator
  readonly anim: AnimState = defaultAnimState()
  readonly interp = new Interp()
  heading = 0
  health = 100
  maxHealth = 100
  armor = 0
  deadTime = 0
  weapon: WeaponId = 'fists'
  private weaponMesh: Mesh | null = null
  /** Tags for missions ("target", "guard"...). */
  tags = new Set<string>()
  /** Set while the actor sits in a vehicle (visual is parented to it). */
  seatedIn: unknown = null
  onDeath?: (info: DamageInfo) => void
  private tmp = new Vector3()

  constructor(
    protected game: Game,
    look: CharacterLook,
    public faction: Faction,
    x: number,
    y: number,
    z: number,
  ) {
    this.rig = buildCharacter(look)
    this.animator = new CharacterAnimator(this.rig)
    this.interp.snap({ x, y, z })
    this.rig.object.position.set(x, y, z)
    game.root.add(this.rig.object)
  }

  get dead() {
    return this.health <= 0
  }

  get position(): Vector3 {
    return this.interp.curr
  }

  /** Approximate chest position (for aiming and line of sight). */
  chest(out = new Vector3()) {
    return out.copy(this.interp.curr).setY(this.interp.curr.y + (this.anim.crouch ? 0.8 : 1.35))
  }

  setWeapon(id: WeaponId) {
    if (id === this.weapon && (this.weaponMesh || WEAPONS[id].melee)) return
    this.weapon = id
    this.weaponMesh?.removeFromParent()
    this.weaponMesh = buildWeaponMesh(id)
    if (this.weaponMesh) this.rig.bones.handR.add(this.weaponMesh)
    this.anim.holding = WEAPONS[id].holding
  }

  /** Returns true if this hit killed the actor. */
  damage(info: DamageInfo): boolean {
    if (this.dead) return false
    let amount = info.amount
    if (this.armor > 0 && info.kind !== 'drown' && info.kind !== 'fall') {
      const absorbed = Math.min(this.armor, amount * 0.7)
      this.armor -= absorbed
      amount -= absorbed
    }
    this.health = Math.max(0, this.health - amount)
    if (this.health <= 0) {
      this.deadTime = 0
      if (info.dir) this.heading = Math.atan2(-info.dir.x, -info.dir.z)
      this.onDeath?.(info)
      this.game.events.emit('actor:killed', { actor: this, info })
      return true
    }
    this.game.events.emit('actor:hurt', { actor: this, info })
    return false
  }

  /** Post-physics: record the new feet position. */
  pushPosition(x: number, y: number, z: number) {
    this.interp.push({ x, y, z })
  }

  render(alpha: number, dt: number, camPos: Vector3) {
    const o = this.rig.object
    if (this.seatedIn) {
      this.anim.seated = true
      this.anim.reclined = (this.seatedIn as { spec?: { kind: string } }).spec?.kind === 'car'
    } else {
      this.anim.reclined = false
      this.interp.position(alpha, this.tmp)
      o.position.copy(this.tmp)
      o.rotation.set(0, this.heading, 0)
    }
    if (this.dead) this.deadTime += dt
    this.anim.dead = this.dead ? Math.max(0.0001, this.deadTime) : 0
    const d = this.tmp.copy(o.getWorldPosition(this.tmp)).distanceTo(camPos)
    o.visible = d < 160
    // Shadow LOD: distant characters don't cast shadows (halves their cost).
    this.rig.mesh.castShadow = d < 45
    if (o.visible && (d < 70 || this.game.frame % 2 === 0)) this.animator.update(d < 70 ? dt : dt * 2, this.anim)
  }

  dispose() {
    this.weaponMesh?.removeFromParent()
    disposeCharacter(this.rig)
  }
}
