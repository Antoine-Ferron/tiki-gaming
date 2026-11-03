import type { GameDefinition } from './types'
import clicker from './clicker'
import mastermind from './mastermind'
import rushHour from './rush-hour'
import sdvCivilisation from './sdv-civilisation'

/**
 * Catalogue des jeux de la plateforme.
 * Pour ajouter un jeu : créer src/games/<slug>/index.ts puis l'ajouter ici
 * (et insérer la ligne correspondante dans public.games via une migration).
 */
export const games: GameDefinition[] = [clicker, rushHour, sdvCivilisation, mastermind]

export function getGame(slug: string): GameDefinition | undefined {
  return games.find((g) => g.slug === slug)
}
