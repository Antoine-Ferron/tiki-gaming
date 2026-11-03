import { lazy } from 'react'
import type { GameDefinition } from '../types'

const echecs: GameDefinition = {
  slug: 'echecs',
  title: 'Échecs',
  description: "Le jeu d'échecs classique, à deux sur le même écran.",
  category: 'duel',
  mode: 'solo',
  component: lazy(() => import('./EchecsGame')),
}

export default echecs
