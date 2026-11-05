/** Doit rester aligné avec la contrainte CHECK games_theme_check de public.games */
export const GAME_THEMES = {
  action: { label: 'Action' },
  reflexion: { label: 'Réflexion' },
  strategie: { label: 'Stratégie' },
} as const

export type GameTheme = keyof typeof GAME_THEMES
