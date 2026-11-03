// @vitest-environment jsdom
// AuthProvider avec le vrai module session.ts : seuls le backend (api.ts) et Supabase sont simulés.
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { AuthContextValue } from './AuthContext'

// Fonctions simples (pas de vi.fn) : un vi.fn qui renvoie une promesse rejetée fait échouer le test.
const fake = vi.hoisted(() => {
  const state = {
    session: (async () => ({ user: null })) as () => Promise<unknown>,
    posts: [] as string[],
    profiles: {} as Record<string, { username: string }>,
    profileError: null as { message: string } | null,
    profileQueries: [] as string[],
  }
  const supabase = {
    from: () => ({
      select: () => ({
        eq: (_column: string, id: string) => ({
          maybeSingle: async () => {
            state.profileQueries.push(id)
            if (state.profileError) return { data: null, error: state.profileError }
            const p = state.profiles[id]
            return { data: p ? { id, username: p.username, avatar_url: null } : null, error: null }
          },
        }),
      }),
    }),
  }
  return { state, supabase }
})
vi.mock('@/lib/api', () => ({
  apiGet: () => fake.state.session(),
  apiPost: async (path: string) => {
    fake.state.posts.push(path)
  },
}))
vi.mock('@/lib/supabase', () => ({ supabase: fake.supabase }))
const logger = vi.hoisted(() => ({ error: vi.fn(), warn: vi.fn() }))
vi.mock('@/lib/logger', () => ({ logger }))

const player = { id: 'u-1', email: 'joueur@example.com' }
const signedIn = async () => ({ user: player, accessToken: 'jwt', expiresAt: Date.now() + 3_600_000 })

// session.ts garde son état au niveau du module : modules neufs par test. AuthProvider et useAuth doivent venir
// du même chargement, sinon ils ne partagent pas le même contexte React.
async function renderProvider() {
  vi.resetModules()
  const { AuthProvider } = await import('./AuthProvider')
  const { useAuth } = await import('./AuthContext')
  render(
    <AuthProvider>
      <State useAuth={useAuth} />
    </AuthProvider>,
  )
}

function State({ useAuth }: { useAuth: () => AuthContextValue }) {
  const { user, profile, loading, signOut, refreshSession, refreshProfile } = useAuth()
  return (
    <>
      <p data-testid="state">
        {loading ? 'chargement' : `${user?.email ?? 'invité'} / ${profile?.username ?? 'sans profil'}`}
      </p>
      <button onClick={() => void signOut()}>déconnexion</button>
      <button onClick={() => void refreshSession()}>relire la session</button>
      <button onClick={() => void refreshProfile()}>relire le profil</button>
    </>
  )
}

const state = () => screen.getByTestId('state').textContent

beforeEach(() => {
  fake.state.session = async () => ({ user: null })
  fake.state.posts = []
  fake.state.profiles = { 'u-1': { username: 'joueur_42' } }
  fake.state.profileError = null
  fake.state.profileQueries = []
  logger.error.mockClear()
})
afterEach(cleanup)

test('un visiteur : session chargée, aucun profil demandé', async () => {
  await renderProvider()

  expect(await screen.findByText('invité / sans profil')).toBeTruthy()
  expect(fake.state.profileQueries).toEqual([])
})

test('un joueur connecté : son profil est chargé', async () => {
  fake.state.session = signedIn
  await renderProvider()

  expect(await screen.findByText('joueur@example.com / joueur_42')).toBeTruthy()
  expect(fake.state.profileQueries).toEqual(['u-1'])
})

test('une erreur Supabase sur le profil est journalisée, le joueur reste connecté', async () => {
  fake.state.session = signedIn
  fake.state.profileError = { message: 'permission denied' }
  await renderProvider()

  // « sans profil » s'affiche aussi pendant le chargement : on attend la réponse de Supabase.
  await waitFor(() =>
    expect(logger.error).toHaveBeenCalledWith(
      { err: { message: 'permission denied' } },
      'Chargement du profil impossible',
    ),
  )
  expect(state()).toBe('joueur@example.com / sans profil')
})

test('un backend injoignable au démarrage laisse l’application en invité', async () => {
  fake.state.session = async () => {
    throw new Error('Le serveur est injoignable.')
  }
  await renderProvider()

  expect(await screen.findByText('invité / sans profil')).toBeTruthy()
  expect(logger.error).toHaveBeenCalledWith(expect.anything(), 'Backend d’authentification injoignable')
})

test('la déconnexion ferme la session côté backend puis repasse en invité', async () => {
  fake.state.session = signedIn
  await renderProvider()
  await screen.findByText('joueur@example.com / joueur_42')

  await act(async () => fireEvent.click(screen.getByText('déconnexion')))

  expect(fake.state.posts).toEqual(['/auth/logout'])
  expect(state()).toBe('invité / sans profil')
})

test('après une connexion, relire la session charge le joueur et son profil', async () => {
  await renderProvider()
  await screen.findByText('invité / sans profil')

  fake.state.session = signedIn
  await act(async () => fireEvent.click(screen.getByText('relire la session')))

  expect(await screen.findByText('joueur@example.com / joueur_42')).toBeTruthy()
})

test('relire le profil affiche le pseudo modifié', async () => {
  fake.state.session = signedIn
  await renderProvider()
  await screen.findByText('joueur@example.com / joueur_42')

  fake.state.profiles['u-1'] = { username: 'nouveau_pseudo' }
  await act(async () => fireEvent.click(screen.getByText('relire le profil')))

  expect(state()).toBe('joueur@example.com / nouveau_pseudo')
})

test('relire le profil d’un visiteur ne fait aucune requête', async () => {
  await renderProvider()
  await screen.findByText('invité / sans profil')

  await act(async () => fireEvent.click(screen.getByText('relire le profil')))

  expect(fake.state.profileQueries).toEqual([])
})
