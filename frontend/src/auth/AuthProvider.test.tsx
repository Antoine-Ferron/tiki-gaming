// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { AuthProvider } from './AuthProvider'
import { useAuth } from './AuthContext'

// Session : un joueur connecté. Profil : Supabase injoignable (la requête rejette au lieu de renvoyer une erreur).
vi.mock('@/lib/session', () => ({
  fetchSession: vi.fn(async () => ({ user: { id: 'u1', email: 'a@b.c' } })),
  onSessionChange: (listener: (user: { id: string; email: string }) => void) => {
    listener({ id: 'u1', email: 'a@b.c' })
    return () => {}
  },
  clearSession: vi.fn(),
}))
vi.mock('@/lib/supabase', () => {
  const query = {
    select: () => query,
    eq: () => query,
    maybeSingle: () => Promise.reject(new TypeError('Failed to fetch')),
  }
  return { supabase: { from: () => query } }
})

afterEach(cleanup)

function ProfileState() {
  const { user, profile, loading } = useAuth()
  return <p>{loading ? 'session…' : `${user?.id} / ${profile === null ? 'sans profil' : profile.username}`}</p>
}

test('un profil impossible à charger ne bloque pas l’application', async () => {
  render(
    <AuthProvider>
      <ProfileState />
    </AuthProvider>,
  )

  expect(await screen.findByText('u1 / sans profil')).toBeTruthy()
})
