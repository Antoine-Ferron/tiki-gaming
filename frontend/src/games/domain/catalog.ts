import { GAME_CATEGORIES, type GameCategory } from '../categories'
import { GAME_THEMES, type GameTheme } from '../themes'

export type CatalogFilter = { category?: GameCategory; theme?: GameTheme }

type Filterable = { category: GameCategory; theme: GameTheme }

/** Jeux qui correspondent à tous les critères renseignés, dans l'ordre du catalogue. */
export function filterGames<T extends Filterable>(games: readonly T[], { category, theme }: CatalogFilter): T[] {
  return games.filter((g) => (!category || g.category === category) && (!theme || g.theme === theme))
}

function pick<K extends string>(choices: Record<K, unknown>, value: string | null): K | undefined {
  return value !== null && Object.hasOwn(choices, value) ? (value as K) : undefined
}

/** Filtre lu dans l'adresse (?categorie=…&theme=…) ; une valeur inconnue est ignorée. */
export function parseCatalogFilter(params: URLSearchParams): CatalogFilter {
  const category = pick(GAME_CATEGORIES, params.get('categorie'))
  const theme = pick(GAME_THEMES, params.get('theme'))
  return { ...(category && { category }), ...(theme && { theme }) }
}
