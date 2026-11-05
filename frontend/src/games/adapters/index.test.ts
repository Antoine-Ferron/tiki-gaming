import { beforeEach, describe, expect, test, vi } from 'vitest'

const fakeConnection = { code: 'ABC', seat: 1, playerCount: 1 }
const createRealtime = vi.fn(() => ({
  createRoom: vi.fn().mockResolvedValue(fakeConnection),
  joinRoom: vi.fn().mockResolvedValue(fakeConnection),
}))

vi.mock('./realtime', () => ({ createRealtime }))
vi.mock('./supabase', () => ({ supabaseScores: {}, supabaseSaves: () => ({}) }))
vi.mock('./local', () => ({ browserStorage: () => null }))

const { platformDeps } = await import('./index')

beforeEach(() => {
  createRealtime.mockClear()
})

describe('platformDeps().realtime', () => {
  test('ne charge le module realtime qu’au premier createRoom/joinRoom, jamais avant', async () => {
    const deps = platformDeps()
    const realtime = deps.realtime('bataille-navale')

    expect(createRealtime).not.toHaveBeenCalled()

    await realtime.createRoom(4)

    expect(createRealtime).toHaveBeenCalledTimes(1)
    expect(createRealtime).toHaveBeenCalledWith('bataille-navale')
  })

  test('un second appel réutilise la même instance plutôt que de réimporter le module', async () => {
    const deps = platformDeps()
    const realtime = deps.realtime('bataille-navale')

    await realtime.createRoom(4)
    await realtime.joinRoom('ABC123')

    expect(createRealtime).toHaveBeenCalledTimes(1)
  })
})
