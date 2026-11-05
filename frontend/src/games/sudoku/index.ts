import { lazy } from 'react'
import type { GameDefinition } from '../types'

const sudoku: GameDefinition = {
  slug: 'sudoku',
  title: 'Sudoku',
  description:
    'Remplis la grille de 9×9 sans répéter un chiffre. Plus tu es rapide et précis, plus ton score est haut.',
  category: 'solo',
  theme: 'reflexion',
  mode: 'solo',
  // Score renvoyé par /api/games/sudoku/check : partie parfaite en difficile (ScoreCalculator, backend).
  // Aligné avec games.max_score.
  scoreLimits: { max: '6864' },
  component: lazy(() => import('./SudokuGame')),
}

export default sudoku
