/**
 * Pousse des branches du baobab (EF-3) : génération au-dessus de l'écran, ménage en dessous.
 * L'aléatoire est un port injecté (Random) : les tests le remplacent par un tirage fixé.
 */
import {
  type Branch,
  BRANCH_HEIGHT,
  BRANCH_WIDTH,
  type GameState,
  PX_PER_METER,
  VIEW_HEIGHT,
  WORLD_WIDTH,
} from './game'

/** Tirage aléatoire dans [0, 1[. */
export type Random = () => number

/** Écart entre deux branches : de 6 m au départ jusqu'à 19 m à partir de 2 000 m (EF-3.2). */
const GAP = { start: 60, end: 190 }
const GAP_FULL_AT = 2000 * PX_PER_METER

/** Écart vertical, en pixels, entre une branche à la hauteur `height` (px) et la suivante. */
export function branchGap(height: number, random: Random): number {
  const progress = Math.min(1, height / GAP_FULL_AT)
  const max = GAP.start + (GAP.end - GAP.start) * progress
  const min = (GAP.start + max) / 2
  return min + (max - min) * random()
}

/** Ajoute des branches jusqu'à un écran au-dessus du haut de l'écran et retire celles passées dessous. */
export function growBranches(state: GameState, random: Random): GameState {
  const branches = state.branches.filter((b) => b.y + BRANCH_HEIGHT >= state.cameraY)
  const limit = state.cameraY + VIEW_HEIGHT * 2
  let top = Math.max(0, ...state.branches.map((b) => b.y))
  while (top < limit) {
    top += branchGap(top, random)
    branches.push(newBranch(top, random))
  }
  return { ...state, branches }
}

function newBranch(y: number, random: Random): Branch {
  return { x: random() * (WORLD_WIDTH - BRANCH_WIDTH), y }
}
