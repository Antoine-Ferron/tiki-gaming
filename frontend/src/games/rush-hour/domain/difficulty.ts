export type Difficulty = 'facile' | 'moyen' | 'difficile'

/** Plages de difficulté selon le minimum de coups (docs/games/rush-hour/regles.md, § 5). */
const DIFFICULTY_RANGES: Record<Difficulty, { min: number; max: number }> = {
  facile: { min: 3, max: 8 },
  moyen: { min: 9, max: 16 },
  difficile: { min: 17, max: Infinity },
}

/** Difficulté d'un plateau, ou null s'il est trop facile (moins de 3 coups). */
export function difficultyOf(optimal: number): Difficulty | null {
  const found = (Object.keys(DIFFICULTY_RANGES) as Difficulty[]).find((d) => {
    const { min, max } = DIFFICULTY_RANGES[d]
    return optimal >= min && optimal <= max
  })
  return found ?? null
}
