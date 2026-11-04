import { lazy } from 'react'
import type { GameDefinition } from '../types'

const mastermind: GameDefinition = {
  slug: 'mastermind',
  title: 'Mastermind',
  description: 'Trouve la combinaison secrète en 10 tentatives.',
  category: 'solo',
  theme: 'reflexion',
  mode: 'solo',
  scoreLimits: { max: 10 },
  component: lazy(() => import('./MastermindGame')),
}

export default mastermind
