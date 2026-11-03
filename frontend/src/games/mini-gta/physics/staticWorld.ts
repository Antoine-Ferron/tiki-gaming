import type { CityData } from '../world/city'
import { buildingColliderBoxes } from '../world/chunkBuilder'
import { MAP_HALF, RING, SLAB_HEIGHT, TERRAIN_CELLS, TERRAIN_RES, shoreX } from '../world/constants'
import { ColliderDesc, Groups, type Physics, RigidBodyDesc } from './physics'

/** Creates every static collider of the city on a single fixed body. */
export function buildStaticWorld(physics: Physics, city: CityData) {
  const world = physics.world
  const body = world.createRigidBody(RigidBodyDesc.fixed())
  const add = (desc: ColliderDesc) => {
    const c = world.createCollider(desc.setCollisionGroups(Groups.static).setFriction(0.9), body)
    physics.setOwner(c, { kind: 'static' })
    return c
  }
  const curb = (x: number, y: number, z: number, hx: number, hy: number, hz: number) => {
    const c = world.createCollider(
      ColliderDesc.cuboid(hx, hy, hz).setTranslation(x, y, z).setCollisionGroups(Groups.curb).setFriction(0.9),
      body,
    )
    physics.setOwner(c, { kind: 'static' })
  }
  const quatY = (a: number) => ({ x: 0, y: Math.sin(a / 2), z: 0, w: Math.cos(a / 2) })
  const cuboid = (x: number, y: number, z: number, hx: number, hy: number, hz: number, rot = 0) =>
    add(ColliderDesc.cuboid(hx, hy, hz).setTranslation(x, y, z).setRotation(quatY(rot)))

  // Terrain heightfield (same layout as Terrain.heights).
  add(ColliderDesc.heightfield(TERRAIN_CELLS, city.terrain.heights, TERRAIN_CELLS * TERRAIN_RES))

  for (const b of city.buildings) {
    for (const box of buildingColliderBoxes(b)) cuboid(box.x, box.y, box.z, box.hx, box.hy, box.hz, box.rot)
  }
  for (const bl of city.blocks) {
    const hy = (SLAB_HEIGHT + 0.3) / 2
    // Dalle de l'îlot : les roues la montent par raycast, la caisse des véhicules ne la heurte pas.
    curb((bl.x0 + bl.x1) / 2, SLAB_HEIGHT - hy, (bl.z0 + bl.z1) / 2, (bl.x1 - bl.x0) / 2, hy, (bl.z1 - bl.z0) / 2)
  }
  for (const c of city.containers) cuboid(c.x, c.y, c.z, 1.25, 1.3, 6, c.rot)
  for (const crane of city.cranes) {
    for (const dx of [-5, 5]) for (const dz of [-5, 5]) cuboid(crane.x + dx, 14, crane.z + dz, 0.5, 14, 0.5)
  }
  // Promenade / quay slabs (match chunkBuilder).
  for (let z = RING.minZ + 20; z < RING.maxZ - 20; z += 40) {
    const xa = Math.max(shoreX(z), shoreX(z + 40)) + (z > 250 && z < 760 ? 0 : 6)
    const xb = RING.minX - 8.5
    if (xb - xa < 4) continue
    cuboid((xa + xb) / 2, -0.4 + 0.02, z + 20, (xb - xa) / 2, 0.4, 20)
  }
  // World boundaries.
  const H = 200
  const E = MAP_HALF - 4
  cuboid(E + 1, H / 2, 0, 1, H, MAP_HALF)
  cuboid(-E - 1, H / 2, 0, 1, H, MAP_HALF)
  cuboid(0, H / 2, E + 1, MAP_HALF, H, 1)
  cuboid(0, H / 2, -E - 1, MAP_HALF, H, 1)
  return body
}
