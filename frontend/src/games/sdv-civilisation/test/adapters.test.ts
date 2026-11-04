import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api'
import { httpGameServer } from '../adapters'
import { TurnConflict } from '../ports'
import { contract } from './fakes'

/**
 * Intégration avec l'API du backend : le vrai client HTTP de l'application (lib/api : CSRF, erreurs), avec
 * fetch simulé qui répond les JSON du contrat. Aucun appel réseau.
 */
const API = '/api/games/sdv-civilisation'
let fetch: ReturnType<typeof vi.fn>

beforeEach(() => {
  // Stub : fetch répond comme le backend ; spy : on vérifie chaque requête envoyée.
  fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)
  vi.stubGlobal('document', { cookie: 'XSRF-TOKEN=jeton' })
})
afterEach(() => vi.unstubAllGlobals())

const reply = (body: unknown, status = 200) =>
  fetch.mockResolvedValueOnce(body === null ? new Response(null, { status }) : Response.json(body, { status }))
const sent = (call: number) => {
  const [url, init] = fetch.mock.calls[call] as [string, RequestInit]
  return { url, method: init.method ?? 'GET', body: init.body && JSON.parse(String(init.body)), init }
}

describe('Serveur de partie HTTP', () => {
  it('lit les merveilles et la partie à reprendre, ou aucune', async () => {
    reply(contract.wonders)
    reply(contract.turnTwo)
    reply(null, 204)

    expect(await httpGameServer.wonders()).toEqual(contract.wonders)
    expect(await httpGameServer.current()).toEqual(contract.turnTwo)
    expect(await httpGameServer.current()).toBeNull()
    expect([sent(0).url, sent(1).url]).toEqual([`${API}/wonders`, `${API}/games/current`])
  })

  it('commence, joue et abandonne une partie avec le jeton CSRF', async () => {
    reply(contract.start, 201)
    reply(contract.turnTwo)
    reply(null, 204)

    expect(await httpGameServer.start('Citadelle d’Orkan')).toEqual(contract.start)
    expect(await httpGameServer.play(6, 'build', 1)).toEqual(contract.turnTwo)
    await httpGameServer.abandon()

    expect(sent(0)).toMatchObject({ url: `${API}/games`, method: 'POST', body: { wonder: 'Citadelle d’Orkan' } })
    expect(sent(1)).toMatchObject({
      url: `${API}/games/current/turns`,
      body: { card: 6, action: 'build', version: 1 },
    })
    expect(sent(2)).toMatchObject({ url: `${API}/games/current/abandon`, method: 'POST' })
    expect((sent(1).init.headers as Record<string, string>)['X-XSRF-TOKEN']).toBe('jeton')
  })

  it('un coup refusé parce que la partie a avancé (409) relit la partie à jour', async () => {
    reply({ error: 'La partie a avancé entre-temps : voici le tour en cours.', game: contract.turnTwo }, 409)
    reply(contract.turnTwo)

    const error = await httpGameServer.play(0, 'discard', 1).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(TurnConflict)
    expect((error as TurnConflict).message).toBe('La partie a avancé entre-temps : voici le tour en cours.')
    expect((error as TurnConflict).game).toEqual(contract.turnTwo)
  })

  it('un coup interdit (400) remonte le message du serveur', async () => {
    reply({ error: 'Tu as déjà construit cette carte.' }, 400)

    await expect(httpGameServer.play(0, 'build', 2)).rejects.toEqual(
      new ApiError(400, 'Tu as déjà construit cette carte.'),
    )
  })

  it('un 409 sans partie à relire remonte tel quel', async () => {
    reply({ error: 'La partie a avancé entre-temps : voici le tour en cours.' }, 409)
    reply(null, 204)

    await expect(httpGameServer.play(0, 'discard', 1)).rejects.toBeInstanceOf(ApiError)
  })
})
