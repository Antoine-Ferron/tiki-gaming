import { beforeEach, describe, expect, test, vi } from 'vitest'
import { ApiError } from '@/lib/api'
import { GameError } from '../errors'

const { apiPost } = vi.hoisted(() => ({ apiPost: vi.fn() }))
vi.mock('@/lib/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/api')>()), apiPost }))
vi.mock('@/lib/supabase', () => ({ supabase: {} }))

const { supabaseScores } = await import('./supabase')

const insert = () => supabaseScores.insert('clicker', 120, { durationMs: 10_000 })

beforeEach(() => {
  apiPost.mockReset()
})

describe('supabaseScores.insert', () => {
  test('envoie le score au backend, sans passer par Supabase', async () => {
    apiPost.mockResolvedValue(undefined)

    await insert()

    expect(apiPost).toHaveBeenCalledWith('/scores', {
      gameSlug: 'clicker',
      score: 120,
      metadata: { durationMs: 10_000 },
    })
  })

  test('un score refusé (400) garde le message du backend', async () => {
    apiPost.mockRejectedValue(new ApiError(400, 'Score refusé : il dépasse le maximum de ce jeu.'))

    await expect(insert()).rejects.toMatchObject({
      code: 'invalid',
      message: 'Score refusé : il dépasse le maximum de ce jeu.',
    })
  })

  test.each([
    [0, 'network'],
    [502, 'network'],
    [401, 'session'],
    [403, 'forbidden'],
    [404, 'not_found'],
  ] as const)('un refus %d devient une GameError %s', async (status, code) => {
    apiPost.mockRejectedValue(new ApiError(status, 'message du backend'))

    const error = await insert().catch((err: unknown) => err)

    expect(error).toBeInstanceOf(GameError)
    expect(error).toMatchObject({ code })
  })

  test('une coupure réseau peut être retentée (le SDK garde alors le score sur l’appareil)', async () => {
    apiPost.mockRejectedValue(new ApiError(0, 'Le serveur est injoignable.'))

    await expect(insert()).rejects.toHaveProperty('retryable', true)
  })
})
