import { lazy } from 'react'
import type { GameDefinition } from '../types'

const dame: GameDefinition = {
  slug: 'dame',
  title: 'Dames internationales',
  description: 'Un damier de cent cases, deux joueurs sur le même écran.',
  category: 'duel',
  theme: 'strategie',
  mode: 'solo',
  component: lazy(() => import('./DameGame')),
}

export default dame
