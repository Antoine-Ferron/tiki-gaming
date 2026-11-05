import { lazy } from 'react'
import type { GameDefinition } from '../types'

const batailleNavale: GameDefinition = {
  slug: 'bataille-navale',
  title: 'Bataille navale',
  description: 'Coule la flotte adverse en duel, à deux sur le même appareil.',
  category: 'duel',
  theme: 'action',
  mode: 'solo',
  scoreLimits: { max: 1340 }, // flotte de 17 cases : 1000 + 17 touchés*20 - 0 raté*10 (logic.ts, computeScore)
  component: lazy(() => import('./BatailleNavaleGame')),
}

export default batailleNavale
