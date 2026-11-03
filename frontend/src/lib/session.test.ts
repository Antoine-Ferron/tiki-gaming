import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const apiGet = vi.fn()
vi.mock('./api', () => ({ apiGet }))
vi.mock('./logger', () => ({ logger: { error: vi.fn(), warn: vi.fn() } }))

// L'état de la session est gardé au niveau du module : un module neuf par test.
async function freshSession() {
  vi.resetModules()
  return import('./session')
}

const NOW = new Date('2026-11-03T10:00:00Z').getTime()
const player = { id: 'u-1', email: 'joueur@example.com' }

beforeEach(() => {
  vi.useFakeTimers({ now: NOW })
  apiGet.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('fetchSession', () => {
  test('lit la session du backend et prévient les abonnés', async () => {
    const { fetchSession, onSessionChange } = await freshSession()
    apiGet.mockResolvedValue({ user: player, accessToken: 'jwt', expiresAt: NOW + 3_600_000 })
    const listener = vi.fn()
    onSessionChange(listener)

    await expect(fetchSession()).resolves.toMatchObject({ user: player })

    expect(apiGet).toHaveBeenCalledWith('/auth/session')
    expect(listener).toHaveBeenCalledWith(player)
  })

  test('regroupe les appels simultanés en une seule requête', async () => {
    const { fetchSession } = await freshSession()
    apiGet.mockResolvedValue({ user: null })

    await Promise.all([fetchSession(), fetchSession(), fetchSession()])

    expect(apiGet).toHaveBeenCalledTimes(1)
  })

  test('refait une requête une fois la précédente terminée, même en échec', async () => {
    const { fetchSession } = await freshSession()
    apiGet.mockRejectedValueOnce(new Error('502')).mockResolvedValueOnce({ user: null })

    await expect(fetchSession()).rejects.toThrow('502')
    await expect(fetchSession()).resolves.toEqual({ user: null })

    expect(apiGet).toHaveBeenCalledTimes(2)
  })

  test('un abonné désinscrit n’est plus prévenu', async () => {
    const { fetchSession, onSessionChange } = await freshSession()
    apiGet.mockResolvedValue({ user: player })
    const listener = vi.fn()
    const unsubscribe = onSessionChange(listener)

    unsubscribe()
    await fetchSession()

    expect(listener).not.toHaveBeenCalled()
  })
})

describe('clearSession', () => {
  test('repasse en invité et prévient les abonnés', async () => {
    const { clearSession, onSessionChange, getAccessToken } = await freshSession()
    const listener = vi.fn()
    onSessionChange(listener)

    clearSession()

    expect(listener).toHaveBeenCalledWith(null)
    // Plus de JWT, et pas de nouvelle requête : la session invité est connue.
    await expect(getAccessToken()).resolves.toBeNull()
    expect(apiGet).not.toHaveBeenCalled()
  })
})

describe('getAccessToken', () => {
  test('charge la session au premier appel et renvoie le JWT', async () => {
    const { getAccessToken } = await freshSession()
    apiGet.mockResolvedValue({ user: player, accessToken: 'jwt-1', expiresAt: NOW + 3_600_000 })

    await expect(getAccessToken()).resolves.toBe('jwt-1')
    await expect(getAccessToken()).resolves.toBe('jwt-1')

    // JWT encore valide : pas de nouvelle requête.
    expect(apiGet).toHaveBeenCalledTimes(1)
  })

  test('redemande un JWT moins d’une minute avant son expiration', async () => {
    const { getAccessToken } = await freshSession()
    apiGet
      .mockResolvedValueOnce({ user: player, accessToken: 'jwt-1', expiresAt: NOW + 3_600_000 })
      .mockResolvedValueOnce({ user: player, accessToken: 'jwt-2', expiresAt: NOW + 7_200_000 })
    await getAccessToken()

    vi.setSystemTime(NOW + 3_600_000 - 61_000)
    await expect(getAccessToken()).resolves.toBe('jwt-1')

    vi.setSystemTime(NOW + 3_600_000 - 59_000)
    await expect(getAccessToken()).resolves.toBe('jwt-2')
    expect(apiGet).toHaveBeenCalledTimes(2)
  })

  test('un invité n’a pas de JWT et ne redemande pas la session', async () => {
    const { getAccessToken } = await freshSession()
    apiGet.mockResolvedValue({ user: null })

    await expect(getAccessToken()).resolves.toBeNull()
    await expect(getAccessToken()).resolves.toBeNull()

    expect(apiGet).toHaveBeenCalledTimes(1)
  })

  test('si le backend est indisponible, les requêtes partent en invité', async () => {
    const { getAccessToken } = await freshSession()
    apiGet.mockRejectedValue(new Error('Le serveur est injoignable.'))

    await expect(getAccessToken()).resolves.toBeNull()
  })

  test('une session expirée côté backend repasse en invité', async () => {
    const { getAccessToken, onSessionChange } = await freshSession()
    apiGet
      .mockResolvedValueOnce({ user: player, accessToken: 'jwt-1', expiresAt: NOW + 30_000 })
      .mockResolvedValueOnce({ user: null })
    const listener = vi.fn()
    onSessionChange(listener)

    await expect(getAccessToken()).resolves.toBe('jwt-1')
    await expect(getAccessToken()).resolves.toBeNull()

    expect(listener).toHaveBeenLastCalledWith(null)
  })
})
