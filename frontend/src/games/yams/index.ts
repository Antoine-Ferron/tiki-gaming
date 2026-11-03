import { lazy } from 'react'
import type { GameDefinition } from '../types'

const yams: GameDefinition = {
  slug: 'yams',
  title: 'Yams',
  description: 'Lance les dés, choisis ta combinaison et remplis ta feuille de score.',
  // Format de jeu : 3 joueurs et + (docs/architecture.md cite le Yam en exemple de 'multi').
  category: 'multi',
  // Accès : jouable sans compte (mode invité), scores classés une fois connecté.
  mode: 'solo',
  component: lazy(() => import('./YamsGame')),
}

export default yams
