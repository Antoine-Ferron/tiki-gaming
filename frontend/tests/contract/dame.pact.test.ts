import path from 'node:path'
import { MatchersV3, PactV4 } from '@pact-foundation/pact'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { playMove, readMatch, startMatch } from '@/games/dame/api'
import { INITIAL, MOVE, NEXT } from '@/games/dame/test-fixtures'
import type { DameView } from '@/games/dame/types'

vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }))
const { eachLike, fromProviderState, integer, like, uuid } = MatchersV3
const pact = new PactV4({
  consumer: 'tiki-dame-frontend',
  provider: 'tiki-dame-backend',
  dir: path.resolve(import.meta.dirname, '../../pacts'),
  logLevel: 'warn',
})
const ROOT = '/api/games/dame/matches'
const headers = { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': like('csrf-dame') }
const names = { whiteName: 'Chérif', blackName: 'Amadou' }
const position = { row: integer(6), column: integer(1) }

function shape(view: DameView) {
  return {
    ...view,
    id: uuid(INITIAL.id),
    startedAt: like(view.startedAt),
    board: {
      rows: 10,
      columns: 10,
      pieces: eachLike({ ...position, owner: like('WHITE'), king: like(false) }),
    },
    legalMoves: eachLike({ from: position, landings: eachLike({ row: integer(5), column: integer(0) }) }),
  }
}

function routeApiTo(url: string) {
  const fetch = globalThis.fetch
  vi.stubGlobal('fetch', (input: string, init?: RequestInit) => fetch(`${url}${input}`, init))
}

beforeEach(() => {
  document.cookie = 'XSRF-TOKEN=csrf-dame'
})
afterEach(() => vi.unstubAllGlobals())

describe('contrat Dames à session', () => {
  test('création avec les deux noms et réponse initiale complète', async () => {
    await pact
      .addInteraction()
      .given('aucune rencontre de dames dans cette session')
      .uponReceiving('la création d’une rencontre de dames')
      .withRequest('POST', ROOT, (req) => req.headers(headers).jsonBody(names))
      .willRespondWith(201, (res) => res.jsonBody(shape(INITIAL)))
      .executeTest(async (server) => {
        routeApiTo(server.url)
        const view = await startMatch(names)
        expect(view).toMatchObject({ id: INITIAL.id, ...names, version: 0, status: 'IN_PROGRESS', winner: null })
        expect(view.board.rows).toBe(10)
        expect(view.legalMoves.length).toBeGreaterThan(0)
      })
  })

  test('relecture d’une rencontre possédée par la session', async () => {
    await pact
      .addInteraction()
      .given('une rencontre de dames est en cours')
      .uponReceiving('la relecture de sa rencontre de dames')
      .withRequest('GET', fromProviderState(`${ROOT}/` + '${matchId}', `${ROOT}/${INITIAL.id}`))
      .willRespondWith(200, (res) => res.jsonBody(shape(INITIAL)))
      .executeTest(async (server) => {
        routeApiTo(server.url)
        await expect(readMatch(INITIAL.id)).resolves.toMatchObject({ version: 0, ...names })
      })
  })

  test('coup versionné sans plateau ni gagnant fournis par le navigateur', async () => {
    await pact
      .addInteraction()
      .given('une rencontre de dames est en cours')
      .uponReceiving('le coup B4 vers A5 de sa rencontre de dames')
      .withRequest('POST', fromProviderState(`${ROOT}/` + '${matchId}/moves', `${ROOT}/${INITIAL.id}/moves`), (req) =>
        req.headers(headers).jsonBody({ version: 0, ...MOVE }),
      )
      .willRespondWith(200, (res) => res.jsonBody(shape(NEXT)))
      .executeTest(async (server) => {
        routeApiTo(server.url)
        await expect(playMove(INITIAL.id, 0, MOVE)).resolves.toMatchObject({ version: 1, currentPlayer: 'BLACK' })
      })
  })

  test('coup interdit refusé avec 400', async () => {
    const illegal = { from: MOVE.from, landings: [{ row: 4, column: 1 }] }
    await pact
      .addInteraction()
      .given('une rencontre de dames est en cours')
      .uponReceiving('un coup interdit dans sa rencontre de dames')
      .withRequest('POST', fromProviderState(`${ROOT}/` + '${matchId}/moves', `${ROOT}/${INITIAL.id}/moves`), (req) =>
        req.headers(headers).jsonBody({ version: 0, ...illegal }),
      )
      .willRespondWith(400, (res) => res.jsonBody({ error: like('Ce coup n’est pas autorisé.') }))
      .executeTest(async (server) => {
        routeApiTo(server.url)
        await expect(playMove(INITIAL.id, 0, illegal)).rejects.toMatchObject({ status: 400 })
      })
  })

  test('une rencontre étrangère ou expirée reste invisible avec 404', async () => {
    await pact
      .addInteraction()
      .given('aucune rencontre de dames dans cette session')
      .uponReceiving('la lecture d’une rencontre de dames absente de sa session')
      .withRequest('GET', `${ROOT}/${INITIAL.id}`)
      .willRespondWith(404, (res) => res.jsonBody({ error: like('Rencontre introuvable dans cette session.') }))
      .executeTest(async (server) => {
        routeApiTo(server.url)
        await expect(readMatch(INITIAL.id)).rejects.toMatchObject({ status: 404 })
      })
  })

  test('une version périmée est refusée avec 409', async () => {
    await pact
      .addInteraction()
      .given('une rencontre de dames a déjà avancé')
      .uponReceiving('un coup envoyé avec une ancienne version de la rencontre')
      .withRequest('POST', fromProviderState(`${ROOT}/` + '${matchId}/moves', `${ROOT}/${INITIAL.id}/moves`), (req) =>
        req.headers(headers).jsonBody({ version: 0, ...MOVE }),
      )
      .willRespondWith(409, (res) => res.jsonBody({ error: like('La partie a changé ou est terminée.') }))
      .executeTest(async (server) => {
        routeApiTo(server.url)
        await expect(playMove(INITIAL.id, 0, MOVE)).rejects.toMatchObject({ status: 409 })
      })
  })
})
