// Essaim de particules qui tourbillonne autour du curseur (décor du lobby, voir CursorSwarm).
// Chaque particule est rappelée par un ressort amorti vers son propre point d'orbite autour de la cible :
// rayons et vitesses de rotation différents donnent l'effet d'un essaim d'abeilles.

export type Particle = { x: number; y: number; vx: number; vy: number; angle: number; orbit: number; spin: number }

/** Vitesse maximale d'une particule, en px/s. */
export const MAX_SPEED = 900
const STIFFNESS = 28
const DAMPING = 5
const JITTER = 1400
/** Pas de temps maximal : après un onglet en arrière-plan, l'essaim reprend sans téléportation. */
const MAX_DT = 1 / 20

export function createSwarm(
  count: number,
  { width, height }: { width: number; height: number },
  random = Math.random,
): Particle[] {
  return Array.from({ length: count }, () => ({
    x: random() * width,
    y: random() * height,
    vx: 0,
    vy: 0,
    angle: random() * Math.PI * 2,
    orbit: 12 + random() * 48,
    spin: (random() < 0.5 ? -1 : 1) * (1.5 + random() * 3),
  }))
}

/** Avance l'essaim de `dt` secondes vers `target` (modifie les particules en place : appelé à chaque image). */
export function stepSwarm(swarm: Particle[], target: { x: number; y: number }, dt: number, random = Math.random) {
  const t = Math.min(dt, MAX_DT)
  // La date d'une image (requestAnimationFrame) peut précéder le performance.now() lu au démarrage : dt < 0.
  if (!(t > 0)) return
  for (const p of swarm) {
    p.angle += p.spin * t
    const goalX = target.x + Math.cos(p.angle) * p.orbit
    const goalY = target.y + Math.sin(p.angle) * p.orbit
    p.vx += ((goalX - p.x) * STIFFNESS - p.vx * DAMPING + (random() - 0.5) * JITTER) * t
    p.vy += ((goalY - p.y) * STIFFNESS - p.vy * DAMPING + (random() - 0.5) * JITTER) * t
    const speed = Math.hypot(p.vx, p.vy)
    if (speed > MAX_SPEED) {
      p.vx *= MAX_SPEED / speed
      p.vy *= MAX_SPEED / speed
    }
    p.x += p.vx * t
    p.y += p.vy * t
  }
}
