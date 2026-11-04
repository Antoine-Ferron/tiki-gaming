// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { ApiError, apiGet, apiPost, toFormErrors } from './api'

vi.mock('./logger', () => ({ logger: { error: vi.fn(), warn: vi.fn() } }))

const fetchMock = vi.fn<typeof fetch>()

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
  document.cookie = 'XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT'
})

describe('apiGet', () => {
  test('appelle /api avec le cookie de session et renvoie le JSON', async () => {
    fetchMock.mockResolvedValue(json(200, { user: null }))

    await expect(apiGet('/auth/session')).resolves.toEqual({ user: null })

    expect(fetchMock).toHaveBeenCalledWith('/api/auth/session', { credentials: 'same-origin' })
  })
})

describe('apiPost', () => {
  test('envoie le corps en JSON avec le jeton CSRF lu dans le cookie', async () => {
    document.cookie = 'XSRF-TOKEN=abc%2B123'
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))

    await apiPost('/auth/login', { email: 'joueur@example.com' })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/auth/login')
    expect(init).toMatchObject({ method: 'POST', credentials: 'same-origin', body: '{"email":"joueur@example.com"}' })
    // Le cookie est encodé, l'en-tête attend la valeur décodée.
    expect(init?.headers).toEqual({ 'Content-Type': 'application/json', 'X-XSRF-TOKEN': 'abc+123' })
  })

  test('envoie un en-tête CSRF vide tant que le cookie n’est pas posé', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))

    await apiPost('/auth/logout')

    expect(fetchMock.mock.calls[0][1]).toMatchObject({ body: '{}', headers: { 'X-XSRF-TOKEN': '' } })
  })

  test('une réponse 204 donne undefined', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))

    await expect(apiPost('/auth/logout')).resolves.toBeUndefined()
  })

  test('une erreur du backend garde son statut, son message et ses champs', async () => {
    fetchMock.mockResolvedValue(
      json(400, { error: 'Certains champs sont invalides.', fields: { email: 'Indique ton adresse email.' } }),
    )

    const error = await apiPost('/auth/signup', {}).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({
      status: 400,
      message: 'Certains champs sont invalides.',
      fields: { email: 'Indique ton adresse email.' },
    })
  })

  test('une erreur sans corps JSON donne un message générique avec le statut', async () => {
    fetchMock.mockResolvedValue(new Response('<html>Bad Gateway</html>', { status: 502 }))

    await expect(apiPost('/auth/login')).rejects.toMatchObject({
      status: 502,
      message: 'Erreur serveur (502)',
      fields: {},
    })
  })

  test('un backend injoignable donne un message lisible (statut 0)', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(apiPost('/auth/login')).rejects.toMatchObject({
      status: 0,
      message: 'Le serveur est injoignable. Vérifie ta connexion et réessaie.',
    })
  })
})

describe('toFormErrors', () => {
  test('affiche les erreurs sur les champs du formulaire', () => {
    const error = new ApiError(400, 'Certains champs sont invalides.', { email: 'Email invalide.' })

    expect(toFormErrors(error, ['email', 'password'])).toEqual({ fields: { email: 'Email invalide.' }, message: null })
  })

  test('un champ que le formulaire n’affiche pas devient le message global', () => {
    const error = new ApiError(400, 'Le pseudo doit contenir au moins 3 caractères.', { username: 'trop court' })

    expect(toFormErrors(error, ['email'])).toEqual({
      fields: {},
      message: 'Le pseudo doit contenir au moins 3 caractères.',
    })
  })

  test('une erreur sans champ donne son message', () => {
    expect(toFormErrors(new ApiError(400, 'Email ou mot de passe incorrect.'), ['email'])).toEqual({
      fields: {},
      message: 'Email ou mot de passe incorrect.',
    })
  })

  test('une erreur inattendue donne un message générique', () => {
    expect(toFormErrors(new Error('bug'), ['email'])).toEqual({
      fields: {},
      message: 'Une erreur inattendue est survenue. Réessaie.',
    })
  })
})
