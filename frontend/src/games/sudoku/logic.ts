export type Grid = number[] // 81 cases, 0 = vide
export type Difficulty = 'easy' | 'medium' | 'hard'

export const DIFFICULTIES: Record<Difficulty, { label: string }> = {
  easy: { label: 'Facile' },
  medium: { label: 'Moyen' },
  hard: { label: 'Difficile' },
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
