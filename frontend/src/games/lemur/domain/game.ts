/**
 * Domaine de LemurTiki : logique pure du jeu, sans React, sans canvas, sans plateforme.
 * Monde en pixels, axe y vers le HAUT (y = 0 au pied du baobab) ; 10 px = 1 m.
 * Le jeu avance par images de durée fixe (STEP_S). Règles : docs/games/lemur/specification.md
 */

export const STEP_S = 1 / 60
export const WORLD_WIDTH = 360
export const GRAVITY = 1800
/** Vitesse d'un saut normal (≈ 22 m de haut). */
export const JUMP_SPEED = 900
/** Vitesse latérale quand le joueur dirige le maki (5 px par image). */
export const RUN_SPEED = 300
export const BRANCH_WIDTH = 70
export const BRANCH_HEIGHT = 12

export type Input = { left: boolean; right: boolean }

/** Position du maki : x = centre, y = pieds ; vy positif vers le haut. */
export type Maki = { x: number; y: number; vy: number }

export type Branch = { x: number; y: number }

export type GameState = {
  maki: Maki
  branches: Branch[]
}

/** Avance la partie d'une image. */
export function step(state: GameState, input: Input): GameState {
  void input
  return state
}
