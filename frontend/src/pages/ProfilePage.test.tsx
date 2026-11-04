// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { ApiError } from '@/lib/api'
import { player, playerProfile, renderPage } from '@/auth/testing'
import ProfilePage from './ProfilePage'

// Faux client Supabase : enregistre la mise à jour et renvoie l'erreur Postgres choisie par le test.
const db = vi.hoisted(() => {
  const state = {
    updates: [] as { table: string; values: unknown; id: unknown }[],
    error: null as { code: string; message: string } | null,
  }
  const supabase = {
    from: (table: string) => ({
      update: (values: unknown) => ({
        eq: async (_column: string, id: unknown) => {
          state.updates.push({ table, values, id })
          return { error: state.error }
        },
      }),
    }),
  }
  return { state, supabase }
})
vi.mock('@/lib/supabase', () => ({ supabase: db.supabase }))
const api = vi.hoisted(() => ({ apiDelete: vi.fn<(path: string) => Promise<void>>() }))
vi.mock('@/lib/api', async (original) => ({
  ...(await original<typeof import('@/lib/api')>()),
  apiDelete: api.apiDelete,
}))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn() } }))

beforeEach(() => {
  api.apiDelete.mockReset()
  db.state.updates = []
  db.state.error = null
})
afterEach(cleanup)

function rename(username: string) {
  fireEvent.change(screen.getByLabelText(/^Pseudo/), { target: { value: username } })
  fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
}

const signedIn = { user: player, profile: playerProfile }

describe('ProfilePage', () => {
  test('attend le chargement du profil', () => {
    renderPage(<ProfilePage />, { url: '/profile', auth: { user: player } })

    expect(screen.getByText('Chargement du profil…')).toBeTruthy()
  })

  test('affiche l’email et le pseudo actuel', () => {
    renderPage(<ProfilePage />, { url: '/profile', auth: signedIn })

    expect(screen.getByText('joueur@example.com')).toBeTruthy()
    expect((screen.getByLabelText(/^Pseudo/) as HTMLInputElement).value).toBe('joueur_42')
  })

  test('enregistre le nouveau pseudo nettoyé et recharge le profil', async () => {
    const auth = renderPage(<ProfilePage />, { url: '/profile', auth: signedIn })

    rename('  nouveau_pseudo ')

    expect(await screen.findByText('Profil mis à jour.')).toBeTruthy()
    expect(db.state.updates).toEqual([{ table: 'profiles', values: { username: 'nouveau_pseudo' }, id: 'u-1' }])
    expect((screen.getByLabelText(/^Pseudo/) as HTMLInputElement).value).toBe('nouveau_pseudo')
    expect(auth.refreshProfile).toHaveBeenCalled()
  })

  test('refuse un pseudo invalide sans appeler Supabase', async () => {
    renderPage(<ProfilePage />, { url: '/profile', auth: signedIn })

    rename('ab')

    expect(await screen.findByText('Le pseudo doit contenir au moins 3 caractères.')).toBeTruthy()
    expect(db.state.updates).toEqual([])
  })

  test.each([
    ['23505', 'Ce pseudo est déjà pris.'],
    ['23514', 'Ce pseudo n’est pas accepté.'],
  ])('traduit le refus de Postgres %s sous le champ', async (code, message) => {
    db.state.error = { code, message: 'violation' }
    const auth = renderPage(<ProfilePage />, { url: '/profile', auth: signedIn })

    rename('pseudo_pris')

    expect((await screen.findByRole('alert')).textContent).toBe(message)
    expect(auth.refreshProfile).not.toHaveBeenCalled()
  })

  test('une autre erreur donne un message général sans détail technique', async () => {
    db.state.error = { code: '08006', message: 'connection failure' }
    renderPage(<ProfilePage />, { url: '/profile', auth: signedIn })

    rename('nouveau_pseudo')

    expect(await screen.findByText('Impossible d’enregistrer le profil. Réessaie plus tard.')).toBeTruthy()
    expect(screen.queryByText(/connection failure/)).toBeNull()
  })

  describe('suppression du compte (RGPD)', () => {
    const deleteButton = () =>
      screen.getByRole('button', { name: 'Supprimer définitivement mon compte' }) as HTMLButtonElement
    const confirmWith = (text: string) =>
      fireEvent.change(screen.getByLabelText(/^Pour confirmer, tape ton pseudo/), { target: { value: text } })

    test('explique ce qui sera effacé, et n’active le bouton qu’une fois le pseudo exact retapé', () => {
      renderPage(<ProfilePage />, { url: '/profile', auth: signedIn })

      expect(screen.getByText(/ton profil, tes scores et tes sauvegardes/)).toBeTruthy()
      expect(deleteButton().disabled).toBe(true)
      confirmWith('joueur_4')
      expect(deleteButton().disabled).toBe(true)
      confirmWith('joueur_42')
      expect(deleteButton().disabled).toBe(false)
    })

    test('supprime le compte, ferme la session côté front et revient à l’accueil', async () => {
      api.apiDelete.mockResolvedValue(undefined)
      const auth = renderPage(<ProfilePage />, { url: '/profile', auth: signedIn })

      confirmWith('joueur_42')
      fireEvent.click(deleteButton())

      expect((await screen.findByTestId('destination')).textContent).toContain('/ {"accountDeleted":true}')
      expect(api.apiDelete).toHaveBeenCalledWith('/auth/account')
      expect(auth.refreshSession).toHaveBeenCalled()
    })

    test('si la suppression échoue, l’explique et reste sur le profil, connecté', async () => {
      api.apiDelete.mockRejectedValue(new ApiError(502, 'Le service d’authentification est indisponible.'))
      const auth = renderPage(<ProfilePage />, { url: '/profile', auth: signedIn })

      confirmWith('joueur_42')
      fireEvent.click(deleteButton())

      expect(await screen.findByText('Le service d’authentification est indisponible.')).toBeTruthy()
      expect(auth.refreshSession).not.toHaveBeenCalled()
      expect(deleteButton().disabled).toBe(false)
    })
  })
})
