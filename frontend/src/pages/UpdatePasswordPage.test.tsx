// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { ApiError } from '@/lib/api'
import { player, renderPage } from '@/auth/testing'
import UpdatePasswordPage from './UpdatePasswordPage'

const api = await vi.hoisted(async () => (await import('@/auth/testing')).fakeApiPost())
vi.mock('@/lib/api', async (original) => ({ ...(await original<typeof import('@/lib/api')>()), apiPost: api.apiPost }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn() } }))

// La page lit le jeton dans l'adresse du navigateur (lien reçu par email), pas dans le routeur.
function openWithHash(hash: string) {
  window.history.replaceState(null, '', `/update-password${hash}`)
}

beforeEach(() => {
  api.reset()
  openWithHash('')
})
afterEach(cleanup)

function save(password: string) {
  fireEvent.change(screen.getByLabelText(/^Mot de passe/), { target: { value: password } })
  fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
}

describe('UpdatePasswordPage', () => {
  test('attend la fin du chargement de la session', () => {
    renderPage(<UpdatePasswordPage />, { url: '/update-password', auth: { loading: true } })

    expect(screen.getByText('Chargement…')).toBeTruthy()
  })

  test('sans lien de réinitialisation ni session, renvoie vers la connexion', () => {
    renderPage(<UpdatePasswordPage />, { url: '/update-password' })

    expect(screen.getByTestId('destination').textContent).toBe('/login null')
  })

  test('avec le lien reçu par email, applique le mot de passe avec son jeton puis connecte le joueur', async () => {
    openWithHash('#access_token=jeton-du-lien&type=recovery&expires_in=3600')
    const auth = renderPage(<UpdatePasswordPage />, { url: '/update-password' })

    save('nouveau-secret')

    expect((await screen.findByTestId('destination')).textContent).toBe('/profile null')
    expect(api.calls).toEqual([['/auth/password/reset', { accessToken: 'jeton-du-lien', password: 'nouveau-secret' }]])
    expect(auth.refreshSession).toHaveBeenCalled()
  })

  test('un jeton qui n’est pas de type recovery est ignoré', () => {
    openWithHash('#access_token=autre-jeton&type=signup')
    renderPage(<UpdatePasswordPage />, { url: '/update-password' })

    expect(screen.getByTestId('destination').textContent).toBe('/login null')
  })

  test('affiche l’erreur renvoyée par Supabase dans le lien', () => {
    openWithHash('#error=access_denied&error_description=Email+link+is+invalid+or+has+expired')
    renderPage(<UpdatePasswordPage />, { url: '/update-password' })

    expect(screen.getByText('Email link is invalid or has expired')).toBeTruthy()
  })

  test('un joueur connecté change son mot de passe sans jeton', async () => {
    const auth = renderPage(<UpdatePasswordPage />, { url: '/update-password', auth: { user: player } })

    save('nouveau-secret')

    expect((await screen.findByTestId('destination')).textContent).toBe('/profile null')
    expect(api.calls).toEqual([['/auth/password', { password: 'nouveau-secret' }]])
    expect(auth.refreshSession).not.toHaveBeenCalled()
  })

  test('refuse un mot de passe trop court sans appeler le backend', async () => {
    renderPage(<UpdatePasswordPage />, { url: '/update-password', auth: { user: player } })

    save('court')

    expect(await screen.findByText('Le mot de passe doit contenir au moins 8 caractères.')).toBeTruthy()
    expect(api.calls).toEqual([])
  })

  test('affiche un lien expiré refusé par le backend', async () => {
    openWithHash('#access_token=jeton-expire&type=recovery')
    api.reply = async () => {
      throw new ApiError(401, 'Le lien a expiré : demandes-en un nouveau.')
    }
    renderPage(<UpdatePasswordPage />, { url: '/update-password' })

    save('nouveau-secret')

    expect(await screen.findByText('Le lien a expiré : demandes-en un nouveau.')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Enregistrer' }) as HTMLButtonElement).disabled).toBe(false)
  })
})
