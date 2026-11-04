// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { ApiError } from '@/lib/api'
import { renderPage } from '@/auth/testing'
import SignupPage from './SignupPage'

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

function fill(username: string, email: string, password: string) {
  fireEvent.change(screen.getByLabelText(/^Pseudo/), { target: { value: username } })
  fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: email } })
  fireEvent.change(screen.getByLabelText(/^Mot de passe/), { target: { value: password } })
  fireEvent.click(screen.getByRole('button', { name: 'Créer mon compte' }))
}

describe('SignupPage', () => {
  test('vérifie chaque champ avant d’appeler le backend', async () => {
    renderPage(<SignupPage />, { url: '/signup' })

    fill('a!', 'joueur@', 'court')

    expect(
      await screen.findByText(
        'Caractère non autorisé : ! — utilise uniquement des lettres sans accent, des chiffres et _.',
      ),
    ).toBeTruthy()
    expect(screen.getByText('Cette adresse email n’est pas valide.')).toBeTruthy()
    expect(screen.getByText('Le mot de passe doit contenir au moins 8 caractères.')).toBeTruthy()
    expect(api.calls).toEqual([])
  })

  test('avec confirmation par email, invite à vérifier sa boîte sans ouvrir de session', async () => {
    api.reply = async () => ({ confirmationRequired: true })
    const auth = renderPage(<SignupPage />, { url: '/signup' })

    fill(' joueur_42 ', 'joueur@example.com', 'secret-123')

    expect(await screen.findByRole('heading', { name: 'Vérifie tes emails' })).toBeTruthy()
    expect(screen.getByText('joueur@example.com')).toBeTruthy()
    expect(api.calls).toEqual([
      ['/auth/signup', { username: 'joueur_42', email: 'joueur@example.com', password: 'secret-123' }],
    ])
    expect(auth.refreshSession).not.toHaveBeenCalled()
  })

  test('sans confirmation, connecte le joueur et l’envoie à l’accueil', async () => {
    api.reply = async () => ({ confirmationRequired: false })
    const auth = renderPage(<SignupPage />, { url: '/signup' })

    fill('joueur_42', 'joueur@example.com', 'secret-123')

    expect((await screen.findByTestId('destination')).textContent).toBe('/ null')
    expect(auth.refreshSession).toHaveBeenCalled()
  })

  test('affiche sous le bon champ une adresse déjà utilisée', async () => {
    api.reply = async () => {
      throw new ApiError(400, 'Un compte existe déjà avec cette adresse email.', {
        email: 'Un compte existe déjà avec cette adresse email.',
      })
    }
    renderPage(<SignupPage />, { url: '/signup' })

    fill('joueur_42', 'joueur@example.com', 'secret-123')

    expect((await screen.findByRole('alert')).textContent).toBe('Un compte existe déjà avec cette adresse email.')
    expect((screen.getByLabelText(/^Email/) as HTMLInputElement).getAttribute('aria-invalid')).toBe('true')
  })

  test('affiche une erreur générale du backend', async () => {
    api.reply = async () => {
      throw new ApiError(403, 'Les inscriptions sont fermées pour le moment.')
    }
    renderPage(<SignupPage />, { url: '/signup' })

    fill('joueur_42', 'joueur@example.com', 'secret-123')

    expect(await screen.findByText('Les inscriptions sont fermées pour le moment.')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Créer mon compte' }) as HTMLButtonElement).disabled).toBe(false)
  })

  test('propose l’inscription avec Google, qui ramène à l’accueil sans demander de mot de passe', () => {
    renderPage(<SignupPage />, { url: '/signup' })

    fireEvent.click(screen.getByRole('button', { name: 'S’inscrire avec Google' }))

    expect(google.startGoogleAuth).toHaveBeenCalledWith('/')
    expect(api.calls).toEqual([])
    expect((screen.getByRole('button', { name: 'Création…' }) as HTMLButtonElement).disabled).toBe(true)
  })
})
