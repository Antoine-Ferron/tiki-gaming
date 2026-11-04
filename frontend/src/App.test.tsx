// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { AuthContext } from '@/auth/AuthContext'
import { fakeAuth, player } from '@/auth/testing'
import App from './App'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))
afterEach(cleanup)

function renderAt(url: string, auth = fakeAuth()) {
  render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[url]}>
        <App />
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('routes', () => {
  test.each([
    ['/login', 'Connexion'],
    ['/signup', 'Inscription'],
    ['/forgot-password', 'Mot de passe oublié'],
  ])('%s est ouvert aux visiteurs', (url, heading) => {
    renderAt(url)

    expect(screen.getByRole('heading', { level: 1, name: heading })).toBeTruthy()
  })

  test('un joueur connecté qui ouvre la connexion revient au lobby', () => {
    renderAt('/login', fakeAuth({ user: player }))

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Bienvenue sur Tiki Gaming')
  })

  test('une adresse inconnue affiche la page introuvable', () => {
    renderAt('/nulle-part')

    expect(screen.getByRole('heading', { name: 'Page introuvable' })).toBeTruthy()
  })
})
