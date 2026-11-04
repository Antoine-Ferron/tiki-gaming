// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { serverVerifier } from './levelVerifier'

afterEach(() => vi.unstubAllGlobals())

describe('serverVerifier : contrat d’appel avec le serveur (S6)', () => {
  test('envoie les coups et les indices du niveau, et renvoie le score du serveur', async () => {
    // Arrange : Mock de fetch, pour vérifier la requête envoyée au serveur
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ score: 950, moves: 4, optimal: 3 })))
    vi.stubGlobal('fetch', fetch)

    // Act
    const result = await serverVerifier(1, { moves: [{ id: 'X', delta: 3 }], hintsUsed: 0 })

    // Assert
    expect(result).toEqual({ score: 950, moves: 4, optimal: 3 })
    expect(fetch).toHaveBeenCalledOnce()
    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe('/api/games/rush-hour/levels/1/results')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({ moves: [{ vehicle: 'X', delta: 3 }], hints: 0 })
  })

  test('transmet le refus du serveur avec son message', async () => {
    // Arrange
    const refusal = { error: 'Partie refusée : Déplacement impossible : X de 3' }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(refusal), { status: 422 })))

    // Act
    const verifying = serverVerifier(1, { moves: [{ id: 'X', delta: 3 }], hintsUsed: 0 })

    // Assert
    await expect(verifying).rejects.toMatchObject({ status: 422, message: refusal.error })
  })
})
