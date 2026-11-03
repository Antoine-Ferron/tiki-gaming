/** Meilleur score par numéro de niveau. Un niveau présent = un niveau déjà terminé. */
export type BestScores = Record<number, number>

/** Garde le record d'un niveau : il n'est remplacé que par un score strictement meilleur. */
export function recordResult(best: BestScores, levelId: number, score: number) {
  const improved = !(levelId in best) || score > best[levelId]
  return { best: improved ? { ...best, [levelId]: score } : best, improved }
}
