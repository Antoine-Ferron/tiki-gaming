// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { destinations, play } from './api'
import { ApiError } from '@/lib/api'
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

test('cliquer une case mise en évidence joue le coup et affiche la position renvoyée par le serveur', async () => {
  // Arrange
  const afterE4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1'
  vi.mocked(destinations).mockResolvedValue(['e3', 'e4'])
  vi.mocked(play).mockResolvedValue(afterE4)
  render(<EchecsGame />)
  await userEvent.click(screen.getByRole('button', { name: 'e2, pion blanc' }))

  // Act
  await userEvent.click(await screen.findByRole('button', { name: 'e4, case vide' }))

  // Assert : le coup envoyé (mock), la nouvelle position affichée, plus de sélection
  expect(play).toHaveBeenCalledWith(START_FEN, 'e2', 'e4')
  expect(await screen.findByRole('button', { name: 'e4, pion blanc' })).toHaveTextContent('♙')
  expect(screen.getByRole('button', { name: 'e2, case vide' })).toHaveAttribute('aria-pressed', 'false')
  expect(screen.getByRole('button', { name: 'e3, case vide' })).not.toHaveClass('echecs-square-target')
})

test('un coup refusé par le serveur affiche son message et laisse la position inchangée', async () => {
  // Arrange : le stub simule le refus des règles (422)
  vi.mocked(destinations).mockResolvedValue(['e3', 'e4'])
  vi.mocked(play).mockRejectedValue(new ApiError(422, 'Coup refusé : Case inaccessible pour la pièce en e2 : e4'))
  render(<EchecsGame />)
  await userEvent.click(screen.getByRole('button', { name: 'e2, pion blanc' }))

  // Act
  await userEvent.click(await screen.findByRole('button', { name: 'e4, case vide' }))

  // Assert
  expect(await screen.findByRole('alert')).toHaveTextContent('Coup refusé : Case inaccessible pour la pièce en e2 : e4')
  expect(screen.getByRole('button', { name: 'e2, pion blanc' })).toBeInTheDocument()
})

test('le trait est annoncé : aux Blancs au départ, aux Noirs après un coup blanc', async () => {
  // Arrange
  vi.mocked(destinations).mockResolvedValue(['e4'])
  vi.mocked(play).mockResolvedValue('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1')
  render(<EchecsGame />)
  expect(screen.getByRole('status')).toHaveTextContent('Aux Blancs de jouer')

  // Act
  await userEvent.click(screen.getByRole('button', { name: 'e2, pion blanc' }))
  await userEvent.click(await screen.findByRole('button', { name: 'e4, case vide' }))

  // Assert
  expect(await screen.findByText('Aux Noirs de jouer')).toHaveRole('status')
})

test('chaque type de pièce a son nom accessible (cavalier, fou, tour)', () => {
  render(<EchecsGame />)

  expect(screen.getByRole('button', { name: 'b1, cavalier blanc' })).toHaveTextContent('♘')
  expect(screen.getByRole('button', { name: 'c8, fou noir' })).toHaveTextContent('♝')
  expect(screen.getByRole('button', { name: 'h1, tour blanche' })).toHaveTextContent('♖')
})

test('cliquer une case vide sans pièce choisie ne sollicite pas le serveur', async () => {
  render(<EchecsGame />)

  await userEvent.click(screen.getByRole('button', { name: 'e4, case vide' }))

  expect(destinations).not.toHaveBeenCalled()
  expect(play).not.toHaveBeenCalled()
})

test("une case vide qui n'est pas accessible ne joue aucun coup", async () => {
  // Arrange : e2 choisi, ses cases sont e3 et e4
  vi.mocked(destinations).mockResolvedValue(['e3', 'e4'])
  render(<EchecsGame />)
  await userEvent.click(screen.getByRole('button', { name: 'e2, pion blanc' }))
  await screen.findByRole('button', { name: 'e4, case vide' })

  // Act : clic sur e5, hors des cases accessibles
  await userEvent.click(screen.getByRole('button', { name: 'e5, case vide' }))

  // Assert
  expect(play).not.toHaveBeenCalled()
})

test('le message d’erreur disparaît dès que le joueur réessaie', async () => {
  // Arrange : un premier coup refusé
  vi.mocked(destinations).mockResolvedValue(['e4'])
  vi.mocked(play).mockRejectedValueOnce(new ApiError(422, 'Coup refusé : essai'))
  render(<EchecsGame />)
  await userEvent.click(screen.getByRole('button', { name: 'e2, pion blanc' }))
  await userEvent.click(await screen.findByRole('button', { name: 'e4, case vide' }))
  expect(await screen.findByRole('alert')).toBeInTheDocument()

  // Act : le joueur choisit à nouveau une pièce
  await userEvent.click(screen.getByRole('button', { name: 'e2, pion blanc' }))

  // Assert
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})
