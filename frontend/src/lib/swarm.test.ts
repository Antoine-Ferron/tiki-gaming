import { describe, expect, test } from 'vitest'
import { createSwarm, MAX_SPEED, stepSwarm } from './swarm'

// Générateur pseudo-aléatoire reproductible (LCG) : même essaim à chaque exécution.
function seeded(seed = 1) {
  return () => (seed = (seed * 16807) % 2147483647) / 2147483647
}

function run(steps: number, target = { x: 500, y: 300 }) {
  const random = seeded()
  const swarm = createSwarm(30, { width: 1000, height: 600 }, random)
  for (let i = 0; i < steps; i++) stepSwarm(swarm, target, 1 / 60, random)
  return swarm
}

describe('essaim', () => {
  test('crée le nombre demandé de particules dans la fenêtre', () => {
    const swarm = createSwarm(30, { width: 1000, height: 600 }, seeded())

    expect(swarm).toHaveLength(30)
    for (const p of swarm) {
      expect(p.x).toBeGreaterThanOrEqual(0)
      expect(p.x).toBeLessThanOrEqual(1000)
      expect(p.y).toBeGreaterThanOrEqual(0)
      expect(p.y).toBeLessThanOrEqual(600)
    }
  })

  test('les particules finissent par tourner autour de la cible', () => {
    for (const p of run(300)) expect(Math.hypot(p.x - 500, p.y - 300)).toBeLessThan(80)
  })

  test('suit la cible quand elle se déplace', () => {
    const random = seeded()
    const swarm = createSwarm(30, { width: 1000, height: 600 }, random)
    for (let i = 0; i < 300; i++) stepSwarm(swarm, { x: 100, y: 100 }, 1 / 60, random)
    for (let i = 0; i < 300; i++) stepSwarm(swarm, { x: 900, y: 500 }, 1 / 60, random)

    for (const p of swarm) expect(Math.hypot(p.x - 900, p.y - 500)).toBeLessThan(80)
  })

  test('la vitesse reste plafonnée, même sur une cible lointaine', () => {
    const random = seeded()
    const swarm = createSwarm(30, { width: 1000, height: 600 }, random)
    for (let i = 0; i < 20; i++) {
      stepSwarm(swarm, { x: 1e6, y: -1e6 }, 1 / 60, random)
      for (const p of swarm) expect(Math.hypot(p.vx, p.vy)).toBeLessThanOrEqual(MAX_SPEED + 1e-9)
    }
  })

  test('un long gel de l’onglet ne fait pas sauter les particules', () => {
    const random = seeded()
    const swarm = createSwarm(30, { width: 1000, height: 600 }, random)
    const before = swarm.map((p) => ({ x: p.x, y: p.y }))
    stepSwarm(swarm, { x: 1e6, y: 1e6 }, 10, random)

    swarm.forEach((p, i) => expect(Math.hypot(p.x - before[i].x, p.y - before[i].y)).toBeLessThan(MAX_SPEED * 0.1))
  })
})
