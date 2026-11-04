import { lazy } from 'react'
import type { GameDefinition } from '../types'

const sdvCivilisation: GameDefinition = {
  slug: 'sdv-civilisation',
  title: 'SDV Civilisation',
  description: 'Développe ta civilisation en trois âges et affronte les autres joueurs.',
  category: 'multi',
  theme: 'strategie',
  // Jouable en invité : la partie est gardée dans la session (voir docs/games/sdv-civilisation/regles.md).
  mode: 'solo',
  component: lazy(() => import('./SdvCivilisationGame')),
}

export default sdvCivilisation
