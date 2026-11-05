// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import EchecsGame from './EchecsGame'

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
