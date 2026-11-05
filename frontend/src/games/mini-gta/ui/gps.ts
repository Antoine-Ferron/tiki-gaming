import { Vector3 } from 'three'
import type { Game } from '../game/Game'
import { useUiStore } from '../state/uiStore'
import { api } from '../net/api'

let lastTarget: { x: number; z: number } | null = null
let lastFrom = -1
let path: Vector3[] = []
let timer = 0
let pending = false

/** Current GPS destination: mission objective, else map waypoint. */
export function gpsTarget(game: Game): { x: number; z: number; kind: 'mission' | 'waypoint' } | null {
  const obj = game.missions.objective()
  if (obj) return { x: obj.x, z: obj.z, kind: 'mission' }
  const wp = useUiStore.getState().waypoint
  return wp ? { ...wp, kind: 'waypoint' } : null
}

/**
 * Itinéraire routier vers la cible GPS, calculé par le backend (A* côté serveur). La requête est
 * relancée au plus deux fois par seconde quand le joueur change de nœud ou que la cible bouge ;
 * l'itinéraire précédent reste affiché en attendant la réponse.
 */
export function gpsPath(game: Game, dt: number): Vector3[] {
  timer -= dt
  const target = gpsTarget(game)
  if (!target) {
    path = []
    lastTarget = null
    return path
  }
  const p = game.player.position
  const from = game.nav.nearestNode(p.x, p.z)
  const moved = !lastTarget || Math.hypot(lastTarget.x - target.x, lastTarget.z - target.z) > 5
  if (from && !pending && (moved || (timer <= 0 && from.id !== lastFrom))) {
    timer = 0.5
    lastFrom = from.id
    lastTarget = { x: target.x, z: target.z }
    pending = true
    api
      .route({ x: p.x, z: p.z }, target)
      .then((pts) => {
        // Ignore une réponse arrivée après l'effacement de la cible.
        if (lastTarget) path = pts.map((q) => new Vector3(q.x, 0, q.z))
      })
      .catch(() => {})
      .finally(() => (pending = false))
  }
  return path
}
