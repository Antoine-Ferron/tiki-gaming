import { lazy } from 'react'
import type { GameDefinition } from '../types'

const clicker: GameDefinition = {
  slug: 'clicker',
  title: 'Clicker 10s',
  description: 'Clique le plus vite possible pendant 10 secondes.',
  category: 'solo',
  mode: 'solo',
  // 30 clics par seconde pendant 10 s : au-delà, ce n'est plus un humain. Aligné avec games.max_score.
  scoreLimits: { max: 300 },
  component: lazy(() => import('./ClickerGame')),
}

export default clicker
