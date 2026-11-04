// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { ApiError } from '@/lib/api'
import { renderPage } from '@/auth/testing'
import LoginPage from './LoginPage'

const api = await vi.hoisted(async () => (await import('@/auth/testing')).fakeApiPost())
vi.mock('@/lib/api', async (original) => ({ ...(await original<typeof import('@/lib/api')>()), apiPost: api.apiPost }))
const google = vi.hoisted(() => ({ startGoogleAuth: vi.fn() }))
vi.mock('@/lib/google', () => google)
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn() } }))

beforeEach(() => {
  api.reset()
  google.startGoogleAuth.mockReset()
})
afterEach(cleanup)

function fill(email: string, password: string) {
  fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: email } })
  fireEvent.change(screen.getByLabelText(/^Mot de passe/), { target: { value: password } })
  fireEvent.click(screen.getByRole('button', { name: 'Se connecter' }))
}

describe('LoginPage', () => {
  test('vérifie les champs avant d’appeler le backend', async () => {
    renderPage(<LoginPage />, { url: '/login' })

    fill('', '')

    expect(await screen.findByText('Indique ton adresse email.')).toBeTruthy()
    expect(screen.getByText('Indique ton mot de passe.')).toBeTruthy()
    expect(api.calls).toEqual([])
  })

  test('connecte le joueur, relit la session et revient à la page demandée', async () => {
    const auth = renderPage(<LoginPage />, { url: '/login', state: { from: '/games/clicker' } })

    fill(' joueur@example.com ', 'secret-123')

    expect((await screen.findByTestId('destination')).textContent).toBe('/games/clicker null')
    expect(api.calls).toEqual([['/auth/login', { email: 'joueur@example.com', password: 'secret-123' }]])
    expect(auth.refreshSession).toHaveBeenCalled()
  })

  test('sans page demandée, revient à l’accueil', async () => {
    renderPage(<LoginPage />, { url: '/login' })

    fill('joueur@example.com', 'secret-123')

    expect((await screen.findByTestId('destination')).textContent).toBe('/ null')
  })

  test('affiche le refus du backend et ne relit pas la session', async () => {
    api.reply = async () => {
      throw new ApiError(400, 'Email ou mot de passe incorrect.')
    }
    const auth = renderPage(<LoginPage />, { url: '/login' })

    fill('joueur@example.com', 'mauvais')

    expect(await screen.findByText('Email ou mot de passe incorrect.')).toBeTruthy()
    expect(auth.refreshSession).not.toHaveBeenCalled()
    expect((screen.getByRole('button', { name: 'Se connecter' }) as HTMLButtonElement).disabled).toBe(false)
  })

  test('affiche sous le champ une erreur que le backend lui attribue', async () => {
    api.reply = async () => {
      throw new ApiError(400, 'Certains champs sont invalides.', { email: 'Email refusé.' })
    }
    renderPage(<LoginPage />, { url: '/login' })

    fill('joueur@example.com', 'secret-123')

    expect((await screen.findByRole('alert')).textContent).toBe('Email refusé.')
    expect(screen.queryByText('Certains champs sont invalides.')).toBeNull()
  })

  test.each([
    ['google', 'La connexion avec Google a échoué. Réessaie.'],
    ['google-email', 'Ton compte Google doit avoir une adresse email vérifiée.'],
  ])('explique l’échec de la connexion Google (?error=%s)', (code, message) => {
    renderPage(<LoginPage />, { url: `/login?error=${code}`, route: '/login' })

    expect(screen.getByText(message)).toBeTruthy()
  })

  test('ignore un code d’erreur inconnu', () => {
    renderPage(<LoginPage />, { url: '/login?error=autre', route: '/login' })

    expect(document.querySelector('.error')).toBeNull()
  })

  test('le bouton Google part vers Google en revenant à la page demandée, et bloque le formulaire', () => {
    renderPage(<LoginPage />, { url: '/login', state: { from: '/games/clicker' } })

    fireEvent.click(screen.getByRole('button', { name: 'Se connecter avec Google' }))

    expect(google.startGoogleAuth).toHaveBeenCalledWith('/games/clicker')
    expect((screen.getByRole('button', { name: 'Connexion…' }) as HTMLButtonElement).disabled).toBe(true)
  })
})
