import { lazy } from 'react'
import type { GameDefinition } from '../types'

const sudoku: GameDefinition = {
  slug: 'sudoku',
  title: 'Sudoku',
  description:
    'Remplis la grille de 9×9 sans répéter un chiffre. Plus tu es rapide et précis, plus ton score est haut.',
  category: 'solo',
  mode: 'solo',
  // Partie parfaite en difficile (ScoreCalculator, backend) : 3000 de base + 3240 de temps + 10 % sans faute.
  // La formule actuelle du front ne dépasse pas 3000 ; la borne suit les règles du backend. Aligné avec games.max_score.
  scoreLimits: { max: 6864 },
  component: lazy(() => import('./SudokuGame')),
}

export default sudoku
