/** Doit rester aligné avec la contrainte CHECK games_category_check de public.games */
export const GAME_CATEGORIES = {
  solo: { label: 'Solo', players: '1 joueur' },
  duel: { label: 'Duel', players: '2 joueurs' },
  multi: { label: 'Multi', players: '3 joueurs et +' },
} as const

export type GameCategory = keyof typeof GAME_CATEGORIES
