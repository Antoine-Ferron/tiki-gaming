/**
 * Domaine de LemurTiki : logique pure du jeu, sans React, sans canvas, sans plateforme.
 * Monde en pixels, axe y vers le HAUT (y = 0 au pied du baobab) ; 10 px = 1 m.
 * Le jeu avance par images de durée fixe (STEP_S). Règles : docs/games/lemur/specification.md
 */

export const STEP_S = 1 / 60
export const WORLD_WIDTH = 360
/** Hauteur de l'écran de jeu, en pixels du monde. */
export const VIEW_HEIGHT = 640
export const PX_PER_METER = 10
export const GRAVITY = 1800
/** Vitesse d'un saut normal (≈ 22 m de haut). */
export const JUMP_SPEED = 900
/** Vitesse latérale quand le joueur dirige le maki (5 px par image). */
export const RUN_SPEED = 300
/** Largeur du maki (EF-1.6). */
export const MAKI_SIZE = 30
export const BRANCH_WIDTH = 70
export const BRANCH_HEIGHT = 12

export type Input = { left: boolean; right: boolean }

/** Position du maki : x = centre, y = pieds ; vy positif vers le haut. */
export type Maki = { x: number; y: number; vy: number }

export type Branch = { x: number; y: number }

export type GameState = {
  maki: Maki
  branches: Branch[]
  /** Hauteur du bas de l'écran dans le monde (EF-2). */
  cameraY: number
}

/** Avance la partie d'une image. */
export function step(state: GameState, input: Input): GameState {
  const steered = steer(state.maki, input)
  const fallen = applyGravity(steered)
  const landing = findLanding(state.branches, steered, fallen)
  const maki = landing ? bounceOn(fallen, landing) : fallen
  return { ...state, maki }
}

/** EF-1.4, EF-1.5 : le joueur dirige le maki ; sortir d'un côté fait réapparaître de l'autre. */
function steer(maki: Maki, input: Input): Maki {
  const direction = (input.right ? 1 : 0) - (input.left ? 1 : 0)
  return { ...maki, x: wrap(maki.x + direction * RUN_SPEED * STEP_S) }
}

function wrap(x: number): number {
  return ((x % WORLD_WIDTH) + WORLD_WIDTH) % WORLD_WIDTH
}

function applyGravity(maki: Maki): Maki {
  const vy = maki.vy - GRAVITY * STEP_S
  return { ...maki, vy, y: maki.y + vy * STEP_S }
}

function topOf(branch: Branch): number {
  return branch.y + BRANCH_HEIGHT
}

/** EF-1.2, EF-1.3 : la branche dont le maki a franchi le dessus en descendant pendant l'image, s'il y en a une. */
function findLanding(branches: Branch[], before: Maki, after: Maki): Branch | undefined {
  if (after.vy >= 0) return undefined
  return branches.find((b) => isAbove(after.x, b) && before.y >= topOf(b) && after.y <= topOf(b))
}

/** EF-1.6 : une partie du corps du maki est au-dessus de la branche, y compris de l'autre côté d'un bord relié. */
function isAbove(makiX: number, branch: Branch): boolean {
  const half = MAKI_SIZE / 2
  return [-WORLD_WIDTH, 0, WORLD_WIDTH].some((shift) => {
    const x = makiX + shift
    return x + half > branch.x && x - half < branch.x + BRANCH_WIDTH
  })
}

/** Le maki se pose sur la branche et repart à la vitesse d'un saut normal. */
function bounceOn(maki: Maki, branch: Branch): Maki {
  return { ...maki, y: topOf(branch), vy: JUMP_SPEED }
}
