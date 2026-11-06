import type { GameDefinition } from './types'
import bang from './bang'
import clicker from './clicker'
import batailleNavale from './bataille-navale'
import echecs from './echecs'
import dame from './dame'
import prismine from './prismine'
import mastermind from './mastermind'
import lemur from './lemur'
import rushHour from './rush-hour'
import yams from './yams'
import sdvCivilisation from './sdv-civilisation'
import sudoku from './sudoku'
import miniGta from './mini-gta'
import ticTacToe from './tic-tac-toe'
import game2048 from './game-2048'

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
  bang,
  dame,
  ticTacToe,
  prismine,
  lemur,
  game2048,
]

export function getGame(slug: string): GameDefinition | undefined {
  return games.find((g) => g.slug === slug)
}
