import { lazy } from 'react'
import type { GameDefinition } from '../types'

const prismine: GameDefinition = {
  slug: 'prismine',
  title: 'Prismine',
  description: 'Envoie des faisceaux de lumière dans une mine obscure et déduis où se cachent les cristaux.',
  category: 'solo',
  theme: 'reflexion',
  mode: 'solo',
  thumbnail: '/games/prismine/thumbnail.webp',
  component: lazy(() => import('./PrismineGame')),
}

export default prismine
