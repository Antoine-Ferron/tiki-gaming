// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { destinations, play } from './api'
import { START_FEN } from './board'
import EchecsGame from './EchecsGame'

// Doublure du client API : le test de l'écran ne dépend pas du serveur (stub pour les réponses, mock pour les appels).
vi.mock('./api', () => ({ destinations: vi.fn(), play: vi.fn() }))

beforeEach(() => {
  vi.mocked(destinations).mockReset()
  vi.mocked(play).mockReset()
})

afterEach(cleanup)

test("l'échiquier affiche 64 cases, chacune utilisable comme un bouton (règle E1, accessibilité)", () => {
  // Arrange + Act
  render(<EchecsGame />)

  // Assert
  const board = screen.getByRole('group', { name: 'Échiquier' })
  expect(within(board).getAllByRole('button')).toHaveLength(64)
})

test('la case h1 est claire et la case a1 est foncée (règle E3)', () => {
  // Arrange + Act
  render(<EchecsGame />)

  // Assert
  expect(screen.getByRole('button', { name: /^h1,/ })).toHaveClass('echecs-square-light')
  expect(screen.getByRole('button', { name: /^a1,/ })).toHaveClass('echecs-square-dark')
})

test('la partie commence sur la position de départ : chaque case annonce sa pièce (règle E4)', () => {
  // Arrange + Act
  render(<EchecsGame />)

  // Assert : nom accessible pour un lecteur d'écran, symbole visible pour les autres
  expect(screen.getByRole('button', { name: 'e1, roi blanc' })).toHaveTextContent('♔')
  expect(screen.getByRole('button', { name: 'd8, dame noire' })).toHaveTextContent('♛')
  expect(screen.getByRole('button', { name: 'e2, pion blanc' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'e4, case vide' })).toHaveTextContent('')
})

test('cliquer une pièce demande ses cases au serveur et les met en évidence', async () => {
  // Arrange : le stub répond comme le serveur pour le pion e2
  vi.mocked(destinations).mockResolvedValue(['e3', 'e4'])
  render(<EchecsGame />)

  // Act
  await userEvent.click(screen.getByRole('button', { name: 'e2, pion blanc' }))

  // Assert : le bon appel (mock), la case choisie et les cases accessibles (stub)
  expect(destinations).toHaveBeenCalledWith(START_FEN, 'e2')
  expect(screen.getByRole('button', { name: 'e2, pion blanc' })).toHaveAttribute('aria-pressed', 'true')
  expect(await screen.findByRole('button', { name: 'e3, case vide' })).toHaveClass('echecs-square-target')
  expect(screen.getByRole('button', { name: 'e4, case vide' })).toHaveClass('echecs-square-target')
  expect(screen.getByRole('button', { name: 'e5, case vide' })).not.toHaveClass('echecs-square-target')
})
