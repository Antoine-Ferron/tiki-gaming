import { lazy } from 'react'
import type { GameDefinition } from '../types'

const yams: GameDefinition = {
  slug: 'yams',
  title: 'Yams',
  description: 'Lance les dés, choisis ta combinaison et remplis ta feuille de score.',
  // Format de jeu : un seul appareil, 2 joueurs chacun son tour sur le même écran.
  category: 'solo',
  // Genre : choisir les dés à garder et la case à remplir.
  theme: 'strategie',
  // Accès : jouable sans compte (mode invité), scores classés une fois connecté.
  mode: 'solo',
  component: lazy(() => import('./YamsGame')),
  scoreLimits: { max: 375 },
}

export default yams
