/** Erreurs permises avant de perdre : le plafond réel vient du serveur (`GameStore.MAX_MISTAKES`). */
export const DEFAULT_MAX_MISTAKES = 3

/** Combien d'erreurs le joueur peut encore commettre sans perdre. */
export function remainingMistakes(mistakes: number, max: number): number {
  return Math.max(0, max - mistakes)
}

/** Perdue dès que les erreurs dépassent le plafond (la 4e pour un plafond de 3). */
export function isLost(mistakes: number, max: number): boolean {
  return mistakes >= max
}

/** Compteur affiché, jamais au-delà du plafond : « 2/3 ». */
export function mistakesLabel(mistakes: number, max: number): string {
  return `${Math.min(mistakes, max)}/${max}`
}

/** Avertissement quand il ne reste qu'une erreur permise, ou plus aucune. */
export function mistakesWarning(mistakes: number, max: number): string | null {
  const left = remainingMistakes(mistakes, max)
  if (left === 0) return 'Dernière chance : une erreur de plus et la partie est perdue.'
  if (left === 1) return 'Attention : plus qu’une erreur permise.'
  return null
}
