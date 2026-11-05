import { lazy } from 'react'
import type { GameDefinition } from '../types'

const lemur: GameDefinition = {
  slug: 'lemur',
  title: 'LemurTiki',
  description: 'Grimpe le baobab de branche en branche avec le maki, sans te faire rattraper par la fossa.',
  category: 'solo',
  // Genre : jeu de réflexes. La migration d'ajout précède celle des thèmes, qui a donné 'action' par défaut.
  theme: 'action',
  mode: 'solo',
  // Score maximal plausible (EF-6.5) : plus d'une heure d'ascension sans faute. Aligné avec games.max_score.
  scoreLimits: { max: 100_000 },
  component: lazy(() => import('./LemurGame')),
}

export default lemur
