import type { GameDefinition } from './types'
import clicker from './clicker'
import batailleNavale from './bataille-navale'

/**
 * Catalogue des jeux de la plateforme.
 * Pour ajouter un jeu : créer src/games/<slug>/index.ts puis l'ajouter ici
 * (et insérer la ligne correspondante dans public.games via une migration).
 */
export const games: GameDefinition[] = [clicker, batailleNavale]

export function getGame(slug: string): GameDefinition | undefined {
  return games.find((g) => g.slug === slug)
}
