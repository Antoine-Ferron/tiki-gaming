/** Limites de score déclarées par un jeu (voir GameDefinition.scoreLimits). */
export type ScoreLimits = { max?: number }

/** Sans limite déclarée : le plus grand entier représentable sans perte en JavaScript. */
export const DEFAULT_MAX_SCORE = Number.MAX_SAFE_INTEGER

/** Message expliquant pourquoi le score est refusé, ou null s'il est valide. */
export function checkScore(score: number, limits: ScoreLimits = {}): string | null {
  const max = limits.max ?? DEFAULT_MAX_SCORE
  if (!Number.isInteger(score)) return 'Un score doit être un nombre entier.'
  if (score < 0) return 'Un score ne peut pas être négatif.'
  if (score > max) return `Score refusé : ${max} au maximum pour ce jeu.`
  return null
}
