/** Ce dont le classement a besoin : un joueur, son pseudo et son meilleur score. */
export type RankableEntry = { user_id: string; username: string; best_score: number }

export type Ranked<T extends RankableEntry> = T & { rank: number }

// Les pseudos sont uniques sans tenir compte de la casse (index lower(username)) : jamais d'égalité.
const byUsername = new Intl.Collator('fr')

/**
 * Classe les entrées par meilleur score décroissant. Les ex æquo partagent le même rang et les rangs
 * suivants sont sautés (1, 1, 3) ; à score égal, l'ordre d'affichage suit le pseudo pour rester stable.
 */
export function rankLeaderboard<T extends RankableEntry>(entries: readonly T[]): Ranked<T>[] {
  const sorted = [...entries].sort((a, b) => b.best_score - a.best_score || byUsername.compare(a.username, b.username))
  const ranked: Ranked<T>[] = []
  for (const [i, entry] of sorted.entries()) {
    const previous = ranked[i - 1]
    const rank = previous?.best_score === entry.best_score ? previous.rank : i + 1
    ranked.push({ ...entry, rank })
  }
  return ranked
}
