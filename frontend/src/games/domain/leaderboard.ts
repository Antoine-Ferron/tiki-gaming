/** Ce dont le classement a besoin : un joueur, son pseudo et son meilleur score. */
export type RankableEntry = { user_id: string; username: string; best_score: number }

export type Ranked<T extends RankableEntry> = T & { rank: number }

const byUsername = new Intl.Collator('fr', { sensitivity: 'base' })

/**
 * Classe les entrées par meilleur score décroissant. Les ex æquo partagent le même rang et les rangs
 * suivants sont sautés (1, 1, 3) ; à score égal, l'ordre d'affichage suit le pseudo pour rester stable.
 */
export function rankLeaderboard<T extends RankableEntry>(entries: readonly T[]): Ranked<T>[] {
  const sorted = [...entries].sort((a, b) => b.best_score - a.best_score || byUsername.compare(a.username, b.username))
  return sorted
    .map((entry, i) => {
      const rank = i > 0 && sorted[i - 1].best_score === entry.best_score ? -1 : i + 1
      return { ...entry, rank }
    })
    .map((entry, i, all) => (entry.rank === -1 ? { ...entry, rank: all[i - 1].rank } : entry))
}
