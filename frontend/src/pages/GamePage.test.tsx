// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { AuthContext, type AuthContextValue } from '@/auth/AuthContext'
import type { GameDefinition, GameProps } from '@/games/types'
import GamePage from './GamePage'

// Pas de Supabase en test unitaire : le client n'est jamais appelé par ces scénarios.
vi.mock('@/lib/supabase', () => ({ supabase: {} }))

// Deux jeux factices : un sans compte, un à compte requis (vi.hoisted : vi.mock est remonté en tête de fichier).
const { games } = await vi.hoisted(async () => {
  const { lazy } = await import('react')
  function FakeGame({ ctx }: GameProps) {
    return <p>Jeu lancé pour {ctx.player?.username ?? 'invité'}</p>
  }
  const fakeGame = (slug: string, mode: GameDefinition['mode']): GameDefinition => ({
    slug,
    title: `Jeu ${slug}`,
    description: '',
    category: 'solo',
    mode,
    component: lazy(async () => ({ default: FakeGame })),
  })
  return { games: [fakeGame('solo-game', 'solo'), fakeGame('account-game', 'multiplayer')] }
})

vi.mock('@/games/registry', () => ({ games, getGame: (slug: string) => games.find((g) => g.slug === slug) }))

afterEach(cleanup)

const profile = { id: 'u1', username: 'alice', avatar_url: null, created_at: '', updated_at: '' }

function renderAt(path: string, auth: Partial<AuthContextValue>) {
  const value: AuthContextValue = {
    user: null,
    profile: null,
    loading: false,
    refreshProfile: async () => {},
    refreshSession: async () => {},
    signOut: async () => {},
    ...auth,
  }
  render(
    <AuthContext.Provider value={value}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/games/:slug" element={<GamePage />} />
          <Route path="/login" element={<p>Page de connexion</p>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('GamePage', () => {
  test('jeu inconnu : page introuvable', () => {
    renderAt('/games/nope', {})

    expect(screen.queryByText(/Jeu lancé/)).toBeNull()
    expect(screen.getByRole('heading').textContent).not.toContain('Jeu')
  })

  test('jeu sans compte, invité : lance le jeu avec l’avertissement invité', async () => {
    renderAt('/games/solo-game', {})

    expect(await screen.findByText('Jeu lancé pour invité')).toBeTruthy()
    expect(screen.getByText(/Tu joues en invité/)).toBeTruthy()
  })

  test('jeu à compte requis, invité : redirige vers la connexion', () => {
    renderAt('/games/account-game', {})

    expect(screen.getByText('Page de connexion')).toBeTruthy()
  })

  test('session en cours de chargement : attend avant de décider', () => {
    renderAt('/games/account-game', { loading: true })

    expect(screen.getByText('Chargement…')).toBeTruthy()
  })

  test('connecté : lance le jeu avec le joueur, sans avertissement invité', async () => {
    renderAt('/games/account-game', { user: { id: 'u1', email: 'a@b.c' }, profile })

    expect(await screen.findByText('Jeu lancé pour alice')).toBeTruthy()
    expect(screen.queryByText(/Tu joues en invité/)).toBeNull()
  })
})
