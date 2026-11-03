import { BoxGeometry, Color, Group, Mesh, MeshStandardMaterial, TorusGeometry } from 'three'
import { buildWeaponMesh } from '../procgen/weapons/weaponModel'
import { useGameStore } from '../state/gameStore'
import type { Game } from '../game/Game'
import { addWeapon, WEAPONS, type WeaponId } from './weapons'
import { formatMoney } from '../domain/format'

type Kind =
  | { type: 'money'; amount: number }
  | { type: 'weapon'; id: WeaponId; rounds: number }
  | { type: 'armor' }
  | { type: 'health' }

interface Pickup {
  kind: Kind
  x: number
  y: number
  z: number
  mesh: Group
  respawn: number
  /** Seconds until available again (fixed pickups), -1 = one-shot. */
  cooldown: number
  timer: number
}

const moneyGeo = new BoxGeometry(0.35, 0.18, 0.2)
const moneyMat = new MeshStandardMaterial({
  color: new Color(0.2, 0.7, 0.25),
  emissive: new Color(0.1, 0.5, 0.15),
  roughness: 0.4,
})
const ringGeo = new TorusGeometry(0.5, 0.04, 6, 24).rotateX(Math.PI / 2)
const ringMat = new MeshStandardMaterial({ color: 0xffffff, emissive: new Color(0.6, 0.8, 1), emissiveIntensity: 1.5 })
const armorMat = new MeshStandardMaterial({
  color: new Color(0.2, 0.35, 0.8),
  emissive: new Color(0.1, 0.2, 0.6),
  roughness: 0.5,
})
const healthMat = new MeshStandardMaterial({
  color: new Color(0.9, 0.9, 0.9),
  emissive: new Color(0.6, 0.1, 0.1),
  roughness: 0.5,
})

/** Money drops and fixed weapon / armor / health pickups. */
export class Pickups {
  private items: Pickup[] = []

  constructor(private game: Game) {
    const L = game.city.locations
    const parks = game.city.blocks.filter((b) => b.park)
    const park = parks[0] ?? game.city.blocks[0]
    this.add({ type: 'weapon', id: 'bat', rounds: 0 }, (park.x0 + park.x1) / 2, 0.15, (park.z0 + park.z1) / 2, 90)
    this.add({ type: 'weapon', id: 'shotgun', rounds: 16 }, L.warehouseDoor.x + 18, 0.15, L.warehouseDoor.z + 6, 120)
    this.add({ type: 'weapon', id: 'rifle', rounds: 60 }, L.heliSpawn.x + 15, 0.05, L.heliSpawn.z - 20, 180)
    this.add({ type: 'weapon', id: 'grenade', rounds: 3 }, L.planeSpawn.x - 40, 0.05, L.planeSpawn.z + 10, 180)
    this.add(
      { type: 'weapon', id: 'pistol', rounds: 24 },
      L.safehouseInside.x + 1.5,
      L.safehouseInside.y,
      L.safehouseInside.z + 1.5,
      60,
    )
    this.add({ type: 'armor' }, L.policeStation.x + 3, L.policeStation.y, L.policeStation.z, 120)
    this.add({ type: 'health' }, L.hospital.x + 3, L.hospital.y, L.hospital.z, 60)
    this.add({ type: 'health' }, L.safehouseInside.x - 1.5, L.safehouseInside.y, L.safehouseInside.z + 1.5, 60)
    const hill = game.city.buildings.find((b) => b.rot !== 0)
    if (hill)
      this.add(
        { type: 'weapon', id: 'sniper', rounds: 10 },
        hill.x + Math.cos(hill.rot) * (hill.hw + 3),
        game.city.terrain.heightAt(hill.x, hill.z) + 0.2,
        hill.z - Math.sin(hill.rot) * (hill.hw + 3),
        240,
      )
  }

  private add(kind: Kind, x: number, y: number, z: number, cooldown = -1) {
    const mesh = new Group()
    if (kind.type === 'money') mesh.add(new Mesh(moneyGeo, moneyMat))
    else if (kind.type === 'weapon') {
      const w = buildWeaponMesh(kind.id)
      if (w) {
        w.rotation.set(0, 0, 0)
        w.position.set(0, 0, 0)
        w.scale.setScalar(1.8)
        mesh.add(w)
      }
    } else mesh.add(new Mesh(new BoxGeometry(0.4, 0.4, 0.4), kind.type === 'armor' ? armorMat : healthMat))
    const ring = new Mesh(ringGeo, ringMat)
    ring.position.y = -0.6
    mesh.add(ring)
    mesh.position.set(x, y + 0.8, z)
    this.game.root.add(mesh)
    this.items.push({ kind, x, y, z, mesh, respawn: 0, cooldown, timer: 0 })
  }

  spawnMoney(x: number, y: number, z: number, amount: number) {
    this.add({ type: 'money', amount }, x, Math.max(y, 0.15), z)
  }

  update(dt: number) {
    const p = this.game.player
    const pos = p.position
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i]
      if (it.timer > 0) {
        it.timer -= dt
        it.mesh.visible = it.timer <= 0
        continue
      }
      if (!p.alive || Math.hypot(pos.x - it.x, pos.z - it.z) > 1.6 || Math.abs(pos.y - it.y) > 2.5) continue
      const k = it.kind
      if (k.type === 'money') {
        useGameStore.getState().addMoney(k.amount)
        this.game.events.emit('notify', { text: `+${formatMoney(k.amount)}`, kind: 'success' })
      } else if (k.type === 'weapon') {
        addWeapon(p.inventory, k.id, k.rounds || WEAPONS[k.id].ammoPack)
        this.game.events.emit('notify', { text: `${WEAPONS[k.id].label} récupéré`, kind: 'success' })
      } else if (k.type === 'armor') {
        if (p.actor.armor >= 100) continue
        p.actor.armor = 100
        this.game.events.emit('notify', { text: 'Gilet pare-balles', kind: 'success' })
      } else {
        if (p.actor.health >= p.actor.maxHealth) continue
        p.actor.health = p.actor.maxHealth
        this.game.events.emit('notify', { text: 'Santé restaurée', kind: 'success' })
      }
      if (it.cooldown < 0) {
        it.mesh.removeFromParent()
        this.items.splice(i, 1)
      } else {
        it.timer = it.cooldown
        it.mesh.visible = false
      }
    }
    // Money drops expire far from the player.
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i]
      if (it.kind.type === 'money' && Math.hypot(pos.x - it.x, pos.z - it.z) > 200) {
        it.mesh.removeFromParent()
        this.items.splice(i, 1)
      }
    }
  }

  render(dt: number) {
    for (const it of this.items) {
      if (!it.mesh.visible) continue
      it.mesh.rotation.y += dt * 1.8
      it.mesh.position.y = it.y + 0.8 + Math.sin(performance.now() / 400 + it.x) * 0.1
    }
  }

  /** Blips for the minimap. */
  list() {
    return this.items.filter((i) => i.mesh.visible && i.kind.type !== 'money')
  }
}
