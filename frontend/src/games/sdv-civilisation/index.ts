import { lazy } from 'react'
import type { GameDefinition } from '../types'

const sdvCivilisation: GameDefinition = {
  slug: 'sdv-civilisation',
  title: 'SDV Civilisation',
  description: 'Développe ta civilisation en trois âges et affronte les autres joueurs.',
  category: 'multi',
  theme: 'strategie',
  mode: 'multiplayer',
  component: lazy(() => import('./SdvCivilisationGame')),
}

export default sdvCivilisation
