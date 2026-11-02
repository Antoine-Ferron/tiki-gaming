import { lazy } from 'react'
import type { GameDefinition } from '../types'

const clicker: GameDefinition = {
  slug: 'clicker',
  title: 'Clicker 10s',
  description: 'Clique le plus vite possible pendant 10 secondes.',
  mode: 'solo',
  component: lazy(() => import('./ClickerGame')),
}

export default clicker
