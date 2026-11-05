import { lazy } from 'react'
import type { GameDefinition } from '../types'

const ticTacToe: GameDefinition = {
  slug: 'tic-tac-toe',
  title: 'Tic-Tac-Toe',
  description: 'Aligne trois pions avant ton adversaire.',
  category: 'duel',
  theme: 'strategie',
  mode: 'solo',
  component: lazy(() => import('./TicTacToeGame')),
}

export default ticTacToe
