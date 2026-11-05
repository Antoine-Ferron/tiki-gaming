// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { GameContext } from '../types'
import TicTacToeGame from './TicTacToeGame'

const ctx = { isGuest: true } as GameContext

afterEach(cleanup)

describe('TicTacToeGame', () => {
  it('allows alternating moves on the board', () => {
    render(<TicTacToeGame ctx={ctx} />)

    fireEvent.click(screen.getByRole('gridcell', { name: 'Ligne 1, colonne 1, vide' }))
    fireEvent.click(screen.getByRole('gridcell', { name: 'Ligne 1, colonne 2, vide' }))

    expect(screen.getByRole('gridcell', { name: 'Ligne 1, colonne 1, X' }).textContent).toBe('X')
    expect(screen.getByRole('gridcell', { name: 'Ligne 1, colonne 2, O' }).textContent).toBe('O')
    expect(screen.getByRole('status').textContent).toContain('Tour du joueur X')
  })

  it('announces a winner and disables the board after three aligned moves', () => {
    render(<TicTacToeGame ctx={ctx} />)

    for (const cell of [
      [1, 1],
      [2, 1],
      [1, 2],
      [2, 2],
      [1, 3],
    ]) {
      fireEvent.click(screen.getByRole('gridcell', { name: `Ligne ${cell[0]}, colonne ${cell[1]}, vide` }))
    }

    expect(screen.getByRole('status').textContent).toContain('Le joueur X a gagné !')
    expect(screen.getByRole('grid').textContent).toContain('XXX')
    expect(screen.getAllByRole('gridcell').every((button) => (button as HTMLButtonElement).disabled)).toBe(true)
  })

  it('starts a new game when replay is selected', () => {
    render(<TicTacToeGame ctx={ctx} />)
    fireEvent.click(screen.getByRole('gridcell', { name: 'Ligne 1, colonne 1, vide' }))
    fireEvent.click(screen.getByRole('button', { name: 'Rejouer' }))

    expect(screen.getByRole('status').textContent).toContain('Tour du joueur X')
    expect(screen.getByRole('gridcell', { name: 'Ligne 1, colonne 1, vide' }).textContent).toBe('')
  })
})
