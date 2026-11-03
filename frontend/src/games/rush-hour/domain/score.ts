/** Barème (docs/games/rush-hour/regles.md, section Score). */
export const MAX_LEVEL_SCORE = 1000
export const EXTRA_MOVE_PENALTY = 50
export const HINT_PENALTY = 200

export interface LevelResult {
  moves: number
  /** Nombre minimal de coups du niveau. */
  optimal: number
  hintsUsed: number
}

/** Score d'un niveau, entre 0 et MAX_LEVEL_SCORE. Moins de coups que le minimum est impossible : refusé. */
export function levelScore({ moves, optimal, hintsUsed }: LevelResult): number {
  if (moves < optimal) throw new Error(`Nombre de coups impossible : ${moves} pour un minimum de ${optimal}`)
  if (hintsUsed < 0) throw new Error(`Nombre d’indices impossible : ${hintsUsed}`)
  const penalty = EXTRA_MOVE_PENALTY * (moves - optimal) + HINT_PENALTY * hintsUsed
  return Math.max(0, MAX_LEVEL_SCORE - penalty)
}

/** Score total d'un joueur : somme de ses records par niveau (c'est ce score qui va au classement). */
export function totalScore(best: Record<number, number>): number {
  return Object.values(best).reduce((sum, score) => sum + score, 0)
}
