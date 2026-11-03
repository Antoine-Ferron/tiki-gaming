// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { GameErrorBoundary } from './GameErrorBoundary'

afterEach(cleanup)

// React journalise les erreurs attrapées par une boundary : sortie de test propre.
vi.spyOn(console, 'error').mockImplementation(() => {})

let shouldThrow: Error | null = null

function FlakyGame() {
  if (shouldThrow) throw shouldThrow
  return <p>Partie en cours</p>
}

describe('GameErrorBoundary', () => {
  test('affiche le jeu quand tout va bien', () => {
    shouldThrow = null
    render(
      <GameErrorBoundary gameSlug="clicker">
        <FlakyGame />
      </GameErrorBoundary>,
    )

    expect(screen.getByText('Partie en cours')).toBeTruthy()
  })

  test('remplace un jeu qui plante par un message, et le relance', () => {
    shouldThrow = new Error('Cannot read properties of undefined')
    render(
      <>
        <a href="/">← Tous les jeux</a>
        <GameErrorBoundary gameSlug="clicker">
          <FlakyGame />
        </GameErrorBoundary>
      </>,
    )

    expect(screen.getByRole('alert').textContent).toContain('Le jeu a rencontré un problème')
    expect(screen.getByText('← Tous les jeux')).toBeTruthy()

    shouldThrow = null
    fireEvent.click(screen.getByRole('button', { name: 'Relancer le jeu' }))

    expect(screen.getByText('Partie en cours')).toBeTruthy()
  })

  test('propose de recharger la page quand le code du jeu n’a pas pu être téléchargé', () => {
    shouldThrow = new TypeError('Failed to fetch dynamically imported module: /assets/ClickerGame.js')
    render(
      <GameErrorBoundary gameSlug="clicker">
        <FlakyGame />
      </GameErrorBoundary>,
    )

    expect(screen.getByRole('alert').textContent).toContain('Le jeu n’a pas pu être chargé')
    expect(screen.getByRole('button', { name: 'Recharger la page' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Relancer le jeu' })).toBeNull()
  })
})
