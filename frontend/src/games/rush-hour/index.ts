import { lazy } from 'react'
import type { GameDefinition } from '../types'

const rushHour: GameDefinition = {
  slug: 'rush-hour',
  title: 'Rush Hour',
  description: 'Fais glisser les véhicules pour libérer la sortie à la voiture rouge.',
  category: 'solo',
  theme: 'reflexion',
  mode: 'solo',
  // Score total = somme des records des 20 niveaux, 1000 points maximum chacun. Aligné avec games.max_score.
  scoreLimits: { max: 20000 },
  component: lazy(() => import('./RushHourGame')),
}

export default rushHour
