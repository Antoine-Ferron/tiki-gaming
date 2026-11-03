import { lazy } from 'react'
import type { GameDefinition } from '../types'
import { MAX_SCORE } from './domain/save'

const miniGta: GameDefinition = {
  slug: 'mini-gta',
  title: 'MiniGTA',
  description: 'Une ville entière générée par le code : conduis, remplis des missions et échappe à la police.',
  category: 'solo',
  mode: 'solo',
  // Capture du rendu procédural du jeu (aucun asset externe).
  thumbnail: '/games/mini-gta/thumbnail.webp',
  // Score = tout l'argent gagné en cumulé, plafond large. Aligné avec games.max_score.
  scoreLimits: { max: MAX_SCORE },
  component: lazy(() => import('./MiniGtaGame')),
}

export default miniGta
