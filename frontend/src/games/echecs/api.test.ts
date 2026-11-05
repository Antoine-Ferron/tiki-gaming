// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { destinations, play } from './api'

vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn() } }))

// Stub : un faux fetch qui répond ce qu'on veut, sans serveur (cours J1_PM).
const fetchMock = vi.fn<typeof fetch>()

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('client API des échecs', () => {
  test('destinations : POST /api/games/echecs/destinations avec la FEN et la case, renvoie la liste', async () => {
    fetchMock.mockResolvedValue(json(200, { destinations: ['e3', 'e4'] }))

    await expect(destinations(START, 'e2')).resolves.toEqual(['e3', 'e4'])

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/games/echecs/destinations')
    expect(init).toMatchObject({ method: 'POST', body: JSON.stringify({ fen: START, from: 'e2' }) })
  })

  test('play : POST /api/games/echecs/moves avec le coup, renvoie la nouvelle FEN', async () => {
    const after = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1'
    fetchMock.mockResolvedValue(json(200, { fen: after }))

    await expect(play(START, 'e2', 'e4')).resolves.toBe(after)

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/games/echecs/moves')
    expect(init).toMatchObject({ method: 'POST', body: JSON.stringify({ fen: START, from: 'e2', to: 'e4' }) })
  })
})
