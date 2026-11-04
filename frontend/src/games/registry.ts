import type { GameDefinition } from './types'
import clicker from './clicker'
import batailleNavale from './bataille-navale'
import echecs from './echecs'
import mastermind from './mastermind'
import rushHour from './rush-hour'
import yams from './yams'
import sdvCivilisation from './sdv-civilisation'
import sudoku from './sudoku'
import miniGta from './mini-gta'

/**
 * Catalogue des jeux de la plateforme.
 * Pour ajouter un jeu : créer src/games/<slug>/index.ts puis l'ajouter ici
 * (et insérer la ligne correspondante dans public.games via une migration).
 */
export const games: GameDefinition[] = [
  clicker,
  batailleNavale,
  rushHour,
  sdvCivilisation,
  mastermind,
  sudoku,
  miniGta,
  yams,
  echecs,
]

export function getGame(slug: string): GameDefinition | undefined {
  return games.find((g) => g.slug === slug)
}
