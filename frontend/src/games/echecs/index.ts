import { lazy } from 'react'
import type { GameDefinition } from '../types'

const echecs: GameDefinition = {
  slug: 'echecs',
  title: 'Échecs',
  description: "Le jeu d'échecs classique, à deux sur le même écran.",
  category: 'duel',
  // Genre : jeu de stratégie (aligné avec games.theme en base).
  theme: 'strategie',
  mode: 'solo',
  component: lazy(() => import('./EchecsGame')),
}

export default echecs
