import {
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  PlaneGeometry,
  PointLight,
  Quaternion,
  Vector3,
  type BufferGeometry,
} from 'three'
import { ActiveEvents, type Collider, ColliderDesc, Groups, type RigidBody, RigidBodyDesc } from '../physics/physics'
import {
  facadeMaterial,
  foliageMaterial,
  interiorMaterial,
  lampHeadMaterial,
  metalPropMaterial,
  pavementMaterial,
  propMaterial,
  roadMaterial,
  signalMaterial,
  terrainMaterial,
  waterMaterial,
} from '../render/materials'
import type { GeoBuilder } from '../render/GeoBuilder'
import { REFLECT_LAYER } from '../render/Reflections'
import { buildChunk, buildRoadQuads } from './chunkBuilder'
import type { CityData, Prop, PropKind } from './city'
import { TREE_VARIANTS, barkMaterial, leafMaterial, treeModel, type Species } from './treeModels'
import { CHUNKS_PER_SIDE, RING, WATER_LEVEL, chunkCenter, chunkIndexOf } from './constants'
import {
  PROP_COLLIDER,
  PROP_GEOMETRY,
  containerGeometry,
  craneGeometry,
  lampHeadGeometry,
  signalGeometry,
} from './propGeometries'
import type { Game } from '../game/Game'

interface PropBatch {
  mesh: InstancedMesh
  props: Prop[]
  extra?: InstancedMesh
}

interface Chunk {
  index: number
  center: { x: number; z: number }
  group: Group
  near: Group
  batches: Map<PropKind, PropBatch>
  signals?: { mesh: InstancedMesh; props: Prop[] }
  colliders: Collider[] | null
  built: boolean
}

interface Debris {
  mesh: Mesh
  body: RigidBody
  age: number
}

const _m = new Matrix4()
const _q = new Quaternion()
const _s = new Vector3()
const _p = new Vector3()
const _c = new Color()
const ZERO = new Matrix4().makeScale(0, 0, 0)
const SIGNAL_COLORS = { green: new Color(0.1, 3, 0.4), yellow: new Color(3, 2, 0.1), red: new Color(3, 0.1, 0.05) }

export const WORLD_SETTINGS = { viewDistance: 650, propDistance: 320 }

export class WorldRenderer {
  readonly group = new Group()
  private chunks: Chunk[] = []
  private roadQuads: Map<number, GeoBuilder>
  private propGeo = new Map<PropKind, BufferGeometry>()
  private propIndex = new Map<number, { batch: PropBatch; i: number }>()
  private debris: Debris[] = []
  private lampLights: PointLight[] = []
  private interiorLights: PointLight[] = []
  private lightTimer = 0
  private signalTimer = 0
  private bodyForProps: RigidBody

  constructor(
    private game: Game,
    private city: CityData,
  ) {
    this.roadQuads = buildRoadQuads(city)
    for (let i = 0; i < CHUNKS_PER_SIDE * CHUNKS_PER_SIDE; i++) {
      const group = new Group()
      const near = new Group()
      group.add(near)
      group.visible = false
      this.group.add(group)
      this.chunks.push({
        index: i,
        center: chunkCenter(i),
        group,
        near,
        batches: new Map(),
        colliders: null,
        built: false,
      })
    }
    this.bodyForProps = game.physics.world.createRigidBody(RigidBodyDesc.fixed())

    // Sea
    const water = new Mesh(new PlaneGeometry(9000, 9000, 1, 1).rotateX(-Math.PI / 2), waterMaterial)
    water.position.y = WATER_LEVEL
    water.receiveShadow = true
    water.layers.enable(REFLECT_LAYER)
    this.group.add(water)

    // Pools of real lights near the player (night only); fixed count avoids shader recompiles.
    for (let i = 0; i < 6; i++) {
      const l = new PointLight(0xffc27a, 0, 18, 2)
      this.lampLights.push(l)
      this.group.add(l)
    }
    for (const b of city.buildings.filter((b) => b.hollow && b.special)) {
      const l = new PointLight(0xfff0dd, 0, b.hw * 3, 1.5)
      l.position.set(b.x, b.y0 + b.h - 0.6, b.z)
      this.interiorLights.push(l)
      this.group.add(l)
    }
  }

  private geometryFor(kind: PropKind) {
    let g = this.propGeo.get(kind)
    if (!g) this.propGeo.set(kind, (g = PROP_GEOMETRY[kind]()))
    return g
  }

  private buildChunkMeshes(chunk: Chunk) {
    const geos = buildChunk(this.city, chunk.index, this.roadQuads)
    const add = (
      g: BufferGeometry | null,
      mat: import('three').Material,
      cast: boolean,
      parent: Group = chunk.group,
    ) => {
      if (!g) return
      const m = new Mesh(g, mat)
      m.receiveShadow = true
      m.castShadow = cast
      m.matrixAutoUpdate = false
      if (parent === chunk.group) m.layers.enable(REFLECT_LAYER)
      parent.add(m)
    }
    add(geos.terrain, terrainMaterial, false)
    add(geos.road, roadMaterial, false)
    add(geos.pavement, pavementMaterial, false)
    add(geos.buildings, facadeMaterial, true)
    add(geos.interiors, interiorMaterial, false, chunk.near)

    // Props (instanced per kind)
    const byKind = new Map<PropKind, Prop[]>()
    for (const p of this.city.props) {
      if (p.chunk !== chunk.index) continue
      const list = byKind.get(p.kind) ?? []
      list.push(p)
      byKind.set(p.kind, list)
    }
    this.buildTrees(chunk, byKind.get('tree') ?? [], byKind.get('palm') ?? [])
    byKind.delete('tree')
    byKind.delete('palm')
    for (const [kind, props] of byKind) {
      const mat =
        kind === 'tree' || kind === 'palm'
          ? foliageMaterial
          : kind === 'lamp' || kind === 'trafficLight'
            ? metalPropMaterial
            : propMaterial
      const mesh = new InstancedMesh(this.geometryFor(kind), mat, props.length)
      mesh.castShadow = kind === 'tree' || kind === 'palm' || kind === 'lamp'
      mesh.receiveShadow = true
      const batch: PropBatch = { mesh, props }
      props.forEach((p, i) => {
        mesh.setMatrixAt(i, p.destroyed ? ZERO : this.propMatrix(p))
        if (kind === 'tree')
          mesh.setColorAt(
            i,
            _c.setHSL(0.25 + Math.sin(p.id) * 0.04, 0.5, 0.45 + Math.cos(p.id * 1.3) * 0.08).multiplyScalar(2.1),
          )
        this.propIndex.set(p.id, { batch, i })
      })
      mesh.computeBoundingSphere()
      chunk.near.add(mesh)
      if (kind === 'lamp') {
        const heads = new InstancedMesh(lampHeadGeometry(), lampHeadMaterial, props.length)
        props.forEach((p, i) => heads.setMatrixAt(i, p.destroyed ? ZERO : this.propMatrix(p)))
        heads.computeBoundingSphere()
        chunk.near.add(heads)
        batch.extra = heads
      }
      if (kind === 'trafficLight') {
        const sig = new InstancedMesh(signalGeometry(), signalMaterial, props.length)
        props.forEach((p, i) => {
          sig.setMatrixAt(i, this.propMatrix(p))
          sig.setColorAt(i, SIGNAL_COLORS.red)
        })
        sig.computeBoundingSphere()
        chunk.near.add(sig)
        chunk.signals = { mesh: sig, props }
        batch.extra = sig
      }
      chunk.batches.set(kind, batch)
    }

    // Containers & cranes
    const containers = this.city.containers.filter((c) => c.chunk === chunk.index)
    if (containers.length) {
      const mesh = new InstancedMesh(containerGeometry(), metalPropMaterial, containers.length)
      containers.forEach((c, i) => {
        _q.setFromAxisAngle(_p.set(0, 1, 0), c.rot)
        mesh.setMatrixAt(i, _m.compose(_s.set(c.x, c.y, c.z), _q, _p.set(1, 1, 1)))
        mesh.setColorAt(i, _c.setRGB(c.color[0], c.color[1], c.color[2]))
      })
      mesh.computeBoundingSphere()
      mesh.castShadow = true
      mesh.receiveShadow = true
      chunk.group.add(mesh)
    }
    const cranes = this.city.cranes.filter((c) => chunk.index === chunkIndexOf(c.x, c.z))
    if (cranes.length) {
      const geo = craneGeometry()
      const mesh = new InstancedMesh(geo, metalPropMaterial, cranes.length)
      cranes.forEach((c, i) => mesh.setMatrixAt(i, _m.makeTranslation(c.x, c.y, c.z)))
      mesh.computeBoundingSphere()
      mesh.castShadow = true
      chunk.group.add(mesh)
    }
    chunk.group.updateMatrixWorld(true)
    chunk.built = true
  }

  /** Instanced trees (bark + leaf cards) per species variant; visible at full view distance. */
  private buildTrees(chunk: Chunk, trees: Prop[], palms: Prop[]) {
    const groups = new Map<string, { species: Species; variant: number; props: Prop[] }>()
    const push = (species: Species, p: Prop) => {
      const variant = p.id % TREE_VARIANTS[species]
      const key = `${species}:${variant}`
      let g = groups.get(key)
      if (!g) groups.set(key, (g = { species, variant, props: [] }))
      g.props.push(p)
    }
    for (const p of trees) {
      const wild = p.z < RING.minZ - 15 || p.z > RING.maxZ + 15 || p.x > RING.maxX + 15
      push(wild ? 'conifer' : 'oak', p)
    }
    for (const p of palms) push('palm', p)
    for (const { species, variant, props } of groups.values()) {
      const model = treeModel(species, variant)
      const bark = new InstancedMesh(model.bark, barkMaterial, props.length)
      const leaves = new InstancedMesh(model.leaves, leafMaterial, props.length)
      props.forEach((p, i) => {
        const m = this.propMatrix(p)
        bark.setMatrixAt(i, m)
        leaves.setMatrixAt(i, m)
        const h = Math.sin(p.id * 12.9898) * 0.5 + 0.5
        leaves.setColorAt(i, _c.setHSL(0.22 + h * 0.08, 0.35 + h * 0.2, 0.5).multiplyScalar(1.9))
      })
      for (const m of [bark, leaves]) {
        m.computeBoundingSphere()
        m.castShadow = true
        m.receiveShadow = true
        chunk.group.add(m)
      }
    }
  }

  private propMatrix(p: Prop) {
    _q.setFromAxisAngle(_p.set(0, 1, 0), p.rot)
    return _m.compose(_s.set(p.x, p.y, p.z), _q, _p.set(p.scale, p.scale, p.scale))
  }

  /** Build all chunks around a point synchronously (loading screen). */
  prebuild(x: number, z: number, radius: number) {
    for (const c of this.chunks) {
      if (Math.hypot(c.center.x - x, c.center.z - z) < radius && !c.built) this.buildChunkMeshes(c)
    }
  }

  update(dt: number, camPos: Vector3, playerPos: Vector3, night: number) {
    // Streaming: build at most one chunk per frame, closest first.
    let pending: Chunk | undefined
    let pendingD = Infinity
    for (const c of this.chunks) {
      const d = Math.hypot(c.center.x - camPos.x, c.center.z - camPos.z)
      const inRange = d < WORLD_SETTINGS.viewDistance + 180
      if (inRange && !c.built && d < pendingD) {
        pending = c
        pendingD = d
      }
      c.group.visible = inRange && c.built
      c.near.visible = d < WORLD_SETTINGS.propDistance + 128
      // Prop colliders near the player only.
      const pd = Math.hypot(c.center.x - playerPos.x, c.center.z - playerPos.z)
      if (pd < 300 && !c.colliders) this.addPropColliders(c)
      else if (pd > 420 && c.colliders) this.removePropColliders(c)
    }
    if (pending) this.buildChunkMeshes(pending)

    // Debris lifetime
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i]
      d.age += dt
      const t = d.body.translation()
      const r = d.body.rotation()
      d.mesh.position.set(t.x, t.y, t.z)
      d.mesh.quaternion.set(r.x, r.y, r.z, r.w)
      if (d.age > 40 || Math.hypot(t.x - playerPos.x, t.z - playerPos.z) > 250) {
        this.game.physics.removeBody(d.body)
        d.mesh.removeFromParent()
        this.debris.splice(i, 1)
      }
    }

    this.lightTimer -= dt
    if (this.lightTimer <= 0) {
      this.lightTimer = 0.4
      this.updateLights(playerPos, night)
    }
    this.signalTimer -= dt
    if (this.signalTimer <= 0) {
      this.signalTimer = 0.25
      this.updateSignals(playerPos)
    }
  }

  private updateLights(playerPos: Vector3, night: number) {
    const lamps: { p: Prop; d: number }[] = []
    if (night > 0.05) {
      for (const p of this.city.props) {
        if (p.kind !== 'lamp' || p.destroyed) continue
        const d = Math.abs(p.x - playerPos.x) + Math.abs(p.z - playerPos.z)
        if (d < 90) lamps.push({ p, d })
      }
      lamps.sort((a, b) => a.d - b.d)
    }
    this.lampLights.forEach((l, i) => {
      const lamp = lamps[i]
      if (!lamp) {
        l.intensity = 0
        return
      }
      const off = { x: Math.sin(lamp.p.rot) * 1.9, z: Math.cos(lamp.p.rot) * 1.9 }
      l.position.set(lamp.p.x + off.x, lamp.p.y + 6.6, lamp.p.z + off.z)
      l.intensity = night * 22
    })
    const hollow = this.city.buildings.filter((b) => b.hollow && b.special)
    this.interiorLights.forEach((l, i) => {
      const b = hollow[i]
      l.intensity = Math.hypot(b.x - playerPos.x, b.z - playerPos.z) < 40 ? 7 : 0
    })
  }

  private updateSignals(playerPos: Vector3) {
    const g = this.city.roads.graph
    const t = this.game.time
    for (const c of this.chunks) {
      if (!c.signals || !c.near.visible) continue
      if (Math.hypot(c.center.x - playerPos.x, c.center.z - playerPos.z) > 400) continue
      const { mesh, props } = c.signals
      props.forEach((p, i) => {
        const state = g.lightState(g.nodes[p.node!], g.edges[p.edge!], t)
        mesh.setColorAt(i, SIGNAL_COLORS[state])
        if (p.destroyed) mesh.setMatrixAt(i, ZERO)
      })
      mesh.instanceColor!.needsUpdate = true
      mesh.instanceMatrix.needsUpdate = true
    }
  }

  private addPropColliders(c: Chunk) {
    const world = this.game.physics.world
    c.colliders = []
    for (const p of this.city.props) {
      if (p.chunk !== c.index || p.destroyed) continue
      const def = PROP_COLLIDER[p.kind]
      if (!def) continue
      const s = p.scale
      const desc = ColliderDesc.cuboid(def.hx * s, def.hy * s, def.hz * s)
        .setTranslation(p.x, p.y + def.y * s, p.z)
        .setRotation({ x: 0, y: Math.sin(p.rot / 2), z: 0, w: Math.cos(p.rot / 2) })
        .setCollisionGroups(Groups.prop)
      if (Number.isFinite(def.breakForce)) {
        desc.setActiveEvents(ActiveEvents.CONTACT_FORCE_EVENTS).setContactForceEventThreshold(def.breakForce)
      }
      const col = world.createCollider(desc, this.bodyForProps)
      this.game.physics.setOwner(col, { kind: 'prop', id: p.id })
      c.colliders.push(col)
    }
  }

  private removePropColliders(c: Chunk) {
    for (const col of c.colliders!) if (col.isValid()) this.game.physics.removeCollider(col)
    c.colliders = null
  }

  /** Knock a prop over: hide its instance and spawn a dynamic debris copy. */
  destroyProp(id: number, impulse?: { x: number; y: number; z: number }) {
    const p = this.city.props[id]
    if (!p || p.destroyed) return
    const def = PROP_COLLIDER[p.kind]
    if (!def || !Number.isFinite(def.breakForce)) return
    p.destroyed = true
    const entry = this.propIndex.get(id)
    if (entry) {
      entry.batch.mesh.setMatrixAt(entry.i, ZERO)
      entry.batch.mesh.instanceMatrix.needsUpdate = true
      if (entry.batch.extra) {
        entry.batch.extra.setMatrixAt(entry.i, ZERO)
        entry.batch.extra.instanceMatrix.needsUpdate = true
      }
    }
    const chunk = this.chunks[p.chunk]
    if (chunk.colliders) {
      const idx = chunk.colliders.findIndex(
        (c) =>
          this.game.physics.ownerOf(c)?.kind === 'prop' && (this.game.physics.ownerOf(c) as { id: number }).id === id,
      )
      if (idx >= 0) {
        this.game.physics.removeCollider(chunk.colliders[idx])
        chunk.colliders.splice(idx, 1)
      }
    }
    const world = this.game.physics.world
    const body = world.createRigidBody(
      RigidBodyDesc.dynamic()
        .setTranslation(p.x, p.y, p.z)
        .setRotation({ x: 0, y: Math.sin(p.rot / 2), z: 0, w: Math.cos(p.rot / 2) })
        .setLinearDamping(0.3)
        .setAngularDamping(0.5),
    )
    const col = world.createCollider(
      ColliderDesc.cuboid(def.hx, def.hy, def.hz)
        .setTranslation(0, def.y, 0)
        .setMass(def.mass)
        .setCollisionGroups(Groups.debris),
      body,
    )
    this.game.physics.setOwner(col, { kind: 'debris', ref: null })
    if (impulse) body.applyImpulseAtPoint(impulse, { x: p.x, y: p.y + def.y * 1.6, z: p.z }, true)
    const mat =
      p.kind === 'tree' || p.kind === 'palm' ? foliageMaterial : p.kind === 'lamp' ? metalPropMaterial : propMaterial
    const mesh = new Mesh(this.geometryFor(p.kind), mat)
    mesh.castShadow = true
    this.group.add(mesh)
    this.debris.push({ mesh, body, age: 0 })
    if (p.kind === 'hydrant') this.game.effects.waterSpray(p.x, p.y + 0.6, p.z)
  }

  dispose() {
    this.group.traverse((o) => {
      if (o instanceof Mesh && o.geometry && !(o instanceof InstancedMesh)) o.geometry.dispose()
    })
    this.propGeo.forEach((g) => g.dispose())
    this.group.removeFromParent()
  }
}
