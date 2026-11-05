import { lazy } from 'react'
import type { GameDefinition } from '../types'

const game2048: GameDefinition = {
  slug: 'game-2048',
  title: '2048',
  description: 'Fais glisser les tuiles et fusionne-les pour atteindre 2048.',
  category: 'solo',
  theme: 'reflexion',
  mode: 'solo',
  // Pas de scoreLimits : pas de score maximal (games.max_score à null).
  component: lazy(() => import('./Game2048Game')),
}

export default game2048
