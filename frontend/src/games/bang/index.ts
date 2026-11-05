import { lazy } from 'react'
import type { GameDefinition } from '../types'

const bang: GameDefinition = {
  slug: 'bang',
  title: 'BANG !',
  description: 'Shérif, hors-la-loi et renégat s’affrontent au saloon : à quatre sur le même écran, ou en ligne.',
  thumbnail: '/games/bang/thumbnail.webp',
  category: 'multi',
  theme: 'strategie',
  mode: 'solo',
  component: lazy(() => import('./BangGame')),
}

export default bang
