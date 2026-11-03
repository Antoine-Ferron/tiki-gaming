/**
 * Pousse des branches du baobab (EF-3) : génération au-dessus de l'écran, ménage en dessous.
 * L'aléatoire est un port injecté (Random) : les tests le remplacent par un tirage fixé.
 */
import type { GameState } from './game'

/** Tirage aléatoire dans [0, 1[. */
export type Random = () => number

/** Écart vertical, en pixels, entre une branche à la hauteur `height` (px) et la suivante. */
export function branchGap(height: number, random: Random): number {
  void height
  void random
  return 0
}

/** Ajoute des branches jusqu'à un écran au-dessus du haut de l'écran et retire celles passées dessous. */
export function growBranches(state: GameState, random: Random): GameState {
  void random
  return state
}
