import { describe, expect, test } from 'vitest'
import {
  ActiveEvents,
  Ball,
  ColliderDesc,
  EventQueue,
  groupsInteract,
  RigidBodyDesc,
  RigidBodyType,
  World,
} from './engine'

const DT = 1 / 60
const yaw = (a: number) => ({ x: 0, y: Math.sin(a / 2), z: 0, w: Math.cos(a / 2) })
const g = (membership: number, filter: number) => ((membership & 0xffff) << 16) | (filter & 0xffff)

/** Sol plat de 64 m de côté (heightfield à 0) centré sur l'origine. */
function flatWorld() {
  const world = new World({ x: 0, y: -9.81, z: 0 })
  world.timestep = DT
  const ground = world.createRigidBody(RigidBodyDesc.fixed())
  world.createCollider(ColliderDesc.heightfield(16, new Float32Array(17 * 17), 64), ground)
  return { world, ground }
}

function down(world: World, x: number, z: number) {
  return world.castRayAndGetNormal({ origin: { x, y: 50, z }, dir: { x: 0, y: -1, z: 0 } }, 100, true)
}

describe('groupes de collision', () => {
  test.each([
    ['même appartenance, filtres ouverts', g(1, 0xffff), g(1, 0xffff), true],
    ['B ne filtre pas A', g(1, 0xffff), g(2, 2), false],
    ['A ne filtre pas B', g(1, 1), g(2, 0xffff), false],
    ['filtres croisés', g(1, 2), g(2, 1), true],
  ])('%s', (_, a, b, expected) => {
    expect(groupsInteract(a, b)).toBe(expected)
  })
})

describe('raycasts', () => {
  test('touche le dessus d’une boîte avec sa normale', () => {
    const { world, ground } = flatWorld()
    world.createCollider(ColliderDesc.cuboid(2, 1, 2).setTranslation(0, 1, 0), ground)

    const hit = down(world, 0.5, 0.5)

    expect(hit?.timeOfImpact).toBeCloseTo(48, 3)
    expect(hit?.normal.y).toBeCloseTo(1)
  })

  test('respecte la rotation d’une boîte autour de Y', () => {
    const { world, ground } = flatWorld()
    // Boîte longue de 10 m selon X une fois tournée de 90°.
    world.createCollider(
      ColliderDesc.cuboid(0.5, 1, 5)
        .setTranslation(0, 1, 0)
        .setRotation(yaw(Math.PI / 2)),
      ground,
    )

    expect(down(world, 4, 0)?.timeOfImpact).toBeCloseTo(48, 3)
    expect(down(world, 0, 4)?.timeOfImpact).toBeCloseTo(50, 1)
  })

  test('touche le terrain sous un point', () => {
    const { world } = flatWorld()

    const hit = down(world, 3, -7)

    expect(hit?.timeOfImpact).toBeCloseTo(50, 2)
    expect(hit?.normal.y).toBeCloseTo(1)
  })

  test('rayon horizontal : la boîte la plus proche gagne, à travers les cellules de la grille', () => {
    const { world, ground } = flatWorld()
    const near = world.createCollider(ColliderDesc.cuboid(1, 1, 1).setTranslation(40, 1, 0), ground)
    world.createCollider(ColliderDesc.cuboid(1, 1, 1).setTranslation(90, 1, 0), ground)

    const hit = world.castRayAndGetNormal({ origin: { x: 0, y: 1, z: 0 }, dir: { x: 1, y: 0, z: 0 } }, 200, true)

    expect(hit?.collider).toBe(near)
    expect(hit?.timeOfImpact).toBeCloseTo(39, 3)
    expect(hit?.normal.x).toBeCloseTo(-1)
  })

  test('les groupes, le corps exclu et le prédicat filtrent les colliders', () => {
    const { world } = flatWorld()
    const body = world.createRigidBody(RigidBodyDesc.dynamic().setTranslation(0, 5, 0))
    world.createCollider(ColliderDesc.ball(1).setCollisionGroups(g(4, 0xffff)), body)
    const ray = { origin: { x: 0, y: 50, z: 0 }, dir: { x: 0, y: -1, z: 0 } }

    expect(world.castRayAndGetNormal(ray, 100, true)?.timeOfImpact).toBeCloseTo(44, 3)
    expect(world.castRayAndGetNormal(ray, 100, true, undefined, g(0xffff, 1))?.timeOfImpact).toBeCloseTo(50, 2)
    expect(world.castRayAndGetNormal(ray, 100, true, undefined, undefined, undefined, body)?.timeOfImpact).toBeCloseTo(
      50,
      2,
    )
    expect(
      world.castRayAndGetNormal(ray, 100, true, undefined, undefined, undefined, undefined, (c) => c.body !== body)
        ?.timeOfImpact,
    ).toBeCloseTo(50, 2)
  })

  test('capsule verticale touchée sur son flanc', () => {
    const world = new World({ x: 0, y: 0, z: 0 })
    const body = world.createRigidBody(RigidBodyDesc.kinematicPositionBased().setTranslation(0, 1, 0))
    world.createCollider(ColliderDesc.capsule(0.5, 0.3), body)

    const hit = world.castRayAndGetNormal({ origin: { x: -5, y: 1.2, z: 0 }, dir: { x: 1, y: 0, z: 0 } }, 10, true)

    expect(hit?.timeOfImpact).toBeCloseTo(4.7, 3)
    expect(hit?.normal.x).toBeCloseTo(-1)
  })
})

describe('tests de sphère', () => {
  test('trouve les colliders qui touchent la sphère', () => {
    const { world, ground } = flatWorld()
    const box = world.createCollider(ColliderDesc.cuboid(1, 1, 1).setTranslation(3, 1, 0), ground)
    world.createCollider(ColliderDesc.cuboid(1, 1, 1).setTranslation(30, 1, 0), ground)
    const found: unknown[] = []

    world.intersectionsWithShape({ x: 0, y: 3, z: 0 }, yaw(0), new Ball(2.5), (c) => {
      found.push(c)
      return true
    })

    expect(found).toEqual([box])
  })
})

describe('corps dynamiques', () => {
  test('une boîte tombe et se pose sur le terrain', () => {
    const { world } = flatWorld()
    const body = world.createRigidBody(RigidBodyDesc.dynamic().setTranslation(0, 3, 0))
    world.createCollider(ColliderDesc.cuboid(0.5, 0.5, 0.5).setMass(10), body)

    for (let i = 0; i < 180; i++) world.step()

    expect(body.translation().y).toBeCloseTo(0.5, 1)
  })

  test('le centre de masse suit les colliders mais translation() renvoie l’origine du corps', () => {
    const world = new World({ x: 0, y: 0, z: 0 })
    const body = world.createRigidBody(RigidBodyDesc.dynamic().setTranslation(1, 2, 3))
    world.createCollider(ColliderDesc.cuboid(1, 0.1, 1).setTranslation(0, 1, 0).setMass(10), body)

    expect(body.translation()).toEqual({ x: 1, y: 2, z: 3 })
    expect(body.centerOfMass().y).toBeCloseTo(3)
    expect(body.mass()).toBe(10)
  })

  test('une impulsion change la vitesse de impulsion / masse', () => {
    const world = new World({ x: 0, y: 0, z: 0 })
    const body = world.createRigidBody(RigidBodyDesc.dynamic())
    world.createCollider(ColliderDesc.ball(0.5).setMass(4), body)

    body.applyImpulse({ x: 8, y: 0, z: 0 }, true)

    expect(body.linvel().x).toBeCloseTo(2)
  })

  test('un corps cinématique atteint exactement sa cible au pas suivant', () => {
    const world = new World({ x: 0, y: 0, z: 0 })
    const body = world.createRigidBody(RigidBodyDesc.kinematicPositionBased().setTranslation(0, 0, 0))
    world.createCollider(ColliderDesc.cuboid(1, 1, 1), body)

    body.setNextKinematicTranslation({ x: 2, y: 0, z: 1 })
    body.setNextKinematicRotation(yaw(0.5))
    world.step()

    expect(body.translation().x).toBeCloseTo(2)
    expect(body.translation().z).toBeCloseTo(1)
    expect(body.rotation().y).toBeCloseTo(Math.sin(0.25))
  })

  test('passer en dynamique donne au corps sa masse', () => {
    const world = new World({ x: 0, y: -9.81, z: 0 })
    const body = world.createRigidBody(RigidBodyDesc.kinematicPositionBased().setTranslation(0, 10, 0))
    world.createCollider(ColliderDesc.cuboid(1, 1, 1).setMass(50), body)

    body.setBodyType(RigidBodyType.Dynamic, true)
    world.step()

    expect(body.mass()).toBe(50)
    expect(body.linvel().y).toBeLessThan(0)
  })

  test('un choc violent émet un événement de force sur un collider qui le demande', () => {
    const { world, ground } = flatWorld()
    const prop = world.createCollider(
      ColliderDesc.cuboid(1, 1, 1)
        .setTranslation(0, 1, 0)
        .setActiveEvents(ActiveEvents.CONTACT_FORCE_EVENTS)
        .setContactForceEventThreshold(100),
      ground,
    )
    const body = world.createRigidBody(RigidBodyDesc.dynamic().setTranslation(-4, 1, 0).setLinvel(20, 0, 0))
    world.createCollider(ColliderDesc.cuboid(0.5, 0.5, 0.5).setMass(100), body)
    const events = new EventQueue(true)
    const hits: number[] = []

    for (let i = 0; i < 30; i++) {
      world.step(events)
      events.drainContactForceEvents((e) => hits.push(e.collider1(), e.collider2()))
    }

    expect(hits).toContain(prop.handle)
    expect(body.translation().x).toBeLessThan(0)
  })

  test('un collider retiré n’est plus touché', () => {
    const { world, ground } = flatWorld()
    const box = world.createCollider(ColliderDesc.cuboid(1, 1, 1).setTranslation(0, 1, 0), ground)

    world.removeCollider(box)

    expect(box.isValid()).toBe(false)
    expect(down(world, 0, 0)?.timeOfImpact).toBeCloseTo(50, 2)
  })
})

describe('contrôleur de personnage', () => {
  function character(world: World, x: number, feet: number, z: number) {
    const body = world.createRigidBody(RigidBodyDesc.kinematicPositionBased().setTranslation(x, feet + 0.9, z))
    const collider = world.createCollider(ColliderDesc.capsule(0.58, 0.32), body)
    const cc = world.createCharacterController(0.03)
    cc.enableAutostep(0.45, 0.2, false)
    cc.enableSnapToGround(0.4)
    /** Avance de (dx, dz) en n pas, avec une petite gravité comme CharacterBody. */
    const walk = (dx: number, dz: number, steps: number) => {
      for (let i = 0; i < steps; i++) {
        cc.computeColliderMovement(collider, { x: dx / steps, y: -0.02, z: dz / steps })
        const m = cc.computedMovement()
        const p = body.translation()
        body.setTranslation({ x: p.x + m.x, y: p.y + m.y, z: p.z + m.z }, true)
      }
    }
    return { body, cc, walk, feet: () => body.translation().y - 0.9 }
  }

  test('monte sur un trottoir de 15 cm', () => {
    const { world, ground } = flatWorld()
    world.createCollider(ColliderDesc.cuboid(5, 0.075, 5).setTranslation(6, 0.075, 0), ground)
    const c = character(world, 0, 0, 0)

    c.walk(3, 0, 30)

    expect(c.body.translation().x).toBeCloseTo(3, 1)
    expect(c.feet()).toBeCloseTo(0.15, 2)
    expect(c.cc.computedGrounded()).toBe(true)
  })

  test('glisse le long d’un mur au lieu de le traverser', () => {
    const { world, ground } = flatWorld()
    world.createCollider(ColliderDesc.cuboid(0.5, 3, 10).setTranslation(2, 3, 0), ground)
    const c = character(world, 0, 0, 0)

    c.walk(4, 2, 40)

    expect(c.body.translation().x).toBeLessThanOrEqual(1.5 - 0.32 + 0.01)
    expect(c.body.translation().z).toBeCloseTo(2, 1)
  })

  test('tombe dans le vide puis se pose au sol', () => {
    const { world } = flatWorld()
    const c = character(world, 0, 3, 0)

    for (let i = 0; i < 60; i++) {
      c.cc.computeColliderMovement(c.body.collider(0), { x: 0, y: -0.2, z: 0 })
      const m = c.cc.computedMovement()
      const p = c.body.translation()
      c.body.setTranslation({ x: p.x, y: p.y + m.y, z: p.z }, true)
    }

    expect(c.feet()).toBeCloseTo(0, 3)
    expect(c.cc.computedGrounded()).toBe(true)
  })
})

describe('contrôleur de véhicule', () => {
  function car(world: World) {
    const body = world.createRigidBody(RigidBodyDesc.dynamic().setTranslation(0, 1, 0).setAngularDamping(1.2))
    world.createCollider(ColliderDesc.cuboid(0.9, 0.4, 2.2).setTranslation(0, 0.8, 0).setMass(600), body)
    world.createCollider(ColliderDesc.cuboid(0.7, 0.1, 1.8).setTranslation(0, 0.3, 0).setMass(600), body)
    const vc = world.createVehicleController(body)
    for (const [x, z] of [
      [0.8, 1.4],
      [-0.8, 1.4],
      [0.8, -1.4],
      [-0.8, -1.4],
    ]) {
      vc.addWheel({ x, y: 0.6, z }, { x: 0, y: -1, z: 0 }, { x: -1, y: 0, z: 0 }, 0.3, 0.35)
    }
    for (let i = 0; i < 4; i++) {
      vc.setWheelSuspensionStiffness(i, 30)
      vc.setWheelSuspensionCompression(i, 4)
      vc.setWheelSuspensionRelaxation(i, 5)
      vc.setWheelMaxSuspensionTravel(i, 0.3)
      vc.setWheelMaxSuspensionForce(i, 1200 * 9.81 * 2)
      vc.setWheelFrictionSlip(i, 2)
    }
    const run = (steps: number, engine: number, steer: number) => {
      for (let s = 0; s < steps; s++) {
        for (let i = 0; i < 4; i++) {
          vc.setWheelEngineForce(i, i >= 2 ? engine : 0)
          vc.setWheelSteering(i, i < 2 ? steer : 0)
        }
        vc.updateVehicle(DT, undefined, undefined, (c) => c.body !== body)
        world.step()
      }
    }
    return { body, vc, run }
  }

  test('repose sur ses quatre roues sans s’enfoncer', () => {
    const { world } = flatWorld()
    const { body, vc, run } = car(world)

    run(120, 0, 0)

    expect([0, 1, 2, 3].every((i) => vc.wheelIsInContact(i))).toBe(true)
    expect(body.translation().y).toBeGreaterThan(-0.2)
    expect(body.translation().y).toBeLessThan(0.3)
  })

  test('une force moteur positive fait avancer vers +Z', () => {
    const { world } = flatWorld()
    const { body, run } = car(world)
    run(60, 0, 0)

    run(90, 2000, 0)

    expect(body.linvel().z).toBeGreaterThan(2)
    expect(Math.abs(body.translation().x)).toBeLessThan(0.5)
  })

  test('un braquage positif tourne à gauche (vers +X quand on regarde +Z)', () => {
    const { world } = flatWorld()
    const { body, run } = car(world)
    run(60, 0, 0)

    run(120, 2000, 0.4)

    expect(body.translation().x).toBeGreaterThan(0.5)
  })
})
