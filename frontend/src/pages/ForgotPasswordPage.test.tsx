// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { ApiError } from '@/lib/api'
import { renderPage } from '@/auth/testing'
import ForgotPasswordPage from './ForgotPasswordPage'

const api = await vi.hoisted(async () => (await import('@/auth/testing')).fakeApiPost())
vi.mock('@/lib/api', async (original) => ({ ...(await original<typeof import('@/lib/api')>()), apiPost: api.apiPost }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn() } }))

beforeEach(() => api.reset())
afterEach(cleanup)

function send(email: string) {
  fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: email } })
  fireEvent.click(screen.getByRole('button', { name: 'Envoyer le lien' }))
}

describe('ForgotPasswordPage', () => {
  test('demande une adresse valide avant d’appeler le backend', async () => {
    renderPage(<ForgotPasswordPage />, { url: '/forgot-password' })

    send('')

    expect(await screen.findByText('Indique ton adresse email.')).toBeTruthy()
    expect(api.calls).toEqual([])
  })

  test('envoie la demande puis confirme sans dire si le compte existe', async () => {
    renderPage(<ForgotPasswordPage />, { url: '/forgot-password' })

    send(' joueur@example.com ')

    expect(await screen.findByRole('heading', { name: 'Email envoyé' })).toBeTruthy()
    expect(screen.getByText(/Si un compte existe pour/).textContent).toContain('joueur@example.com')
    expect(api.calls).toEqual([['/auth/password/forgot', { email: 'joueur@example.com' }]])
  })

  test('affiche une erreur du backend et reste sur le formulaire', async () => {
    api.reply = async () => {
      throw new ApiError(429, 'Trop d’emails envoyés. Patiente quelques minutes avant de réessayer.')
    }
    renderPage(<ForgotPasswordPage />, { url: '/forgot-password' })

    send('joueur@example.com')

    expect(await screen.findByText('Trop d’emails envoyés. Patiente quelques minutes avant de réessayer.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Envoyer le lien' })).toBeTruthy()
  })
})
