import { lazy } from 'react'
import type { GameDefinition } from '../types'

const demineur: GameDefinition = {
  slug: 'demineur',
  title: 'Démineur',
  description: 'Révèle les cases sans tomber sur une mine.',
  category: 'solo',
  theme: 'reflexion',
  mode: 'solo',
  // Plafond théorique : score = mineCount × 100 − elapsedSeconds (jamais négatif), donc maximal
  // à Expert (99 mines) en 0 s. Aligné avec la migration qui pose games.max_score.
  scoreLimits: { max: 9900 },
  component: lazy(() => import('./DemineurGame')),
}

export default demineur
