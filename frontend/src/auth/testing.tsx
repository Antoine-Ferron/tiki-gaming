// Utilitaires de test des pages : contexte d'authentification simulé et routeur en mémoire.
import type { ReactElement } from 'react'
import { render } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { vi } from 'vitest'
import { AuthContext, type AuthContextValue } from './AuthContext'

export const player = { id: 'u-1', email: 'joueur@example.com' }
export const playerProfile = { id: 'u-1', username: 'joueur_42', avatar_url: null, created_at: '', updated_at: '' }

export function fakeAuth(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    user: null,
    profile: null,
    loading: false,
    refreshProfile: vi.fn(async () => {}),
    refreshSession: vi.fn(async () => {}),
    signOut: vi.fn(async () => {}),
    ...overrides,
  }
}

/**
 * Remplaçant de `apiPost` : enregistre les appels et répond avec `reply`. Une fonction simple plutôt qu'un
 * `vi.fn` : un `vi.fn` qui renvoie une promesse rejetée fait échouer le test (rejet signalé comme non géré),
 * même quand la page l'attrape.
 */
export function fakeApiPost() {
  const fake = {
    calls: [] as unknown[][],
    reply: (async () => undefined) as (path: string, body?: unknown) => Promise<unknown>,
    apiPost: (path: string, body?: unknown) => {
      fake.calls.push(body === undefined ? [path] : [path, body])
      return fake.reply(path, body)
    },
    reset() {
      fake.calls = []
      fake.reply = async () => undefined
    },
  }
  return fake
}

type Options = { url?: string; state?: unknown; route?: string; auth?: Partial<AuthContextValue> }

/**
 * Affiche `page` à `url`. Toute autre adresse affiche « destination » : chemin, paramètres et état de
 * navigation (pour vérifier une redirection). Renvoie le contexte d'auth utilisé.
 */
export function renderPage(page: ReactElement, { url = '/', state, route, auth }: Options = {}) {
  // Défini ici plutôt qu'au niveau du fichier : un module qui exporte des fonctions ne déclare pas de composant.
  function Destination() {
    const location = useLocation()
    return (
      <p data-testid="destination">
        {location.pathname + location.search} {JSON.stringify(location.state ?? null)}
      </p>
    )
  }
  const value = fakeAuth(auth)
  const { pathname, search, hash } = new URL(url, 'http://localhost')
  render(
    <AuthContext.Provider value={value}>
      <MemoryRouter initialEntries={[{ pathname, search, hash, state }]}>
        <Routes>
          <Route path={route ?? pathname} element={page} />
          <Route path="*" element={<Destination />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
  return value
}
