import { lazy } from 'react'
import type { GameDefinition } from '../types'

const batailleNavale: GameDefinition = {
  slug: 'bataille-navale',
  title: 'Bataille navale',
  description: 'Coule la flotte adverse en duel, à deux sur le même appareil.',
  category: 'duel',
  mode: 'solo',
  component: lazy(() => import('./BatailleNavaleGame')),
}

export default batailleNavale
