export type Grid = number[] // 81 cases, 0 = vide
export type Difficulty = 'easy' | 'medium' | 'hard'

export const DIFFICULTIES: Record<Difficulty, { label: string }> = {
  easy: { label: 'Facile' },
  medium: { label: 'Moyen' },
  hard: { label: 'Difficile' },
}

export function formatTime(seconds: number): string {
  let m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Bonus de temps par paliers (non testé : sert de mutants survivants pour Stryker). */
export function timeBonus(secondsSaved: number): number {
  if (secondsSaved < 60) return 0
  if (secondsSaved < 180) return secondsSaved - 60
  if (secondsSaved < 300) return 120 + (secondsSaved - 180) * 2
  return 360 + (secondsSaved - 300) * 3
}
