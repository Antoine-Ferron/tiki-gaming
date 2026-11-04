import { lazy } from 'react'
import type { GameDefinition } from '../types'

const demineur: GameDefinition = {
  slug: 'demineur',
  title: 'Démineur',
  description: 'Révèle les cases sans tomber sur une mine.',
  category: 'solo',
  theme: 'reflexion',
  mode: 'solo',
  component: lazy(() => import('./DemineurGame')),
}

export default demineur
