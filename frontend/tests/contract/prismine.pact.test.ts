import path from 'node:path'
import { MatchersV3, PactV4 } from '@pact-foundation/pact'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { createPrismineApi } from '@/games/prismine/api'

vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }))
const { eachLike, fromProviderState, integer, like, uuid } = MatchersV3
const pact = new PactV4({
  consumer: 'tiki-prismine-frontend',
  provider: 'tiki-prismine-backend',
  dir: path.resolve(import.meta.dirname, '../../pacts'),
  logLevel: 'warn',
})
const ROOT = '/api/games/prismine/runs'
const RUN_ID = '00000000-0000-4000-8000-000000000001'
const headers = { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': like('csrf-prismine') }
const api = createPrismineApi()

/** Ce que le front lit d'une expédition. Le contrat ne prévoit ni la carte cachée ni sa graine. */
const run = {
  id: uuid(RUN_ID),
  depth: integer(1),
  size: integer(6),
  prisms: integer(3),
  obsidians: integer(0),
  colors: eachLike(integer(1)),
  oil: integer(20),
  score: integer(0),
  floorErrors: integer(0),
  totalProbes: integer(0),
  totalErrors: integer(0),
  probes: [],
}
const probe = { entry: integer(0), revealed: like(false), bounces: integer(0), color: integer(0) }
const floor = {
  depth: integer(1),
  size: integer(6),
  prisms: integer(3),
  obsidians: integer(0),
  colors: eachLike(integer(1)),
  grid: like('....................................'),
  probes: [],
}

function routeApiTo(url: string) {
  const fetch = globalThis.fetch
  vi.stubGlobal('fetch', (input: string, init?: RequestInit) => fetch(`${url}${input}`, init))
}

const currentRun = (suffix = '') => fromProviderState(`${ROOT}/` + '${runId}' + suffix, `${ROOT}/${RUN_ID}${suffix}`)

beforeEach(() => {
  document.cookie = 'XSRF-TOKEN=csrf-prismine'
})
afterEach(() => vi.unstubAllGlobals())

describe('contrat front → serveur arbitre de Prismine', () => {
  test('commencer une expédition', async () => {
    await pact
      .addInteraction()
      .given('aucune expédition Prismine dans cette session')
      .uponReceiving('le démarrage d’une expédition')
      .withRequest('POST', ROOT, (req) => req.headers(headers).jsonBody({}))
      .willRespondWith(201, (res) => res.jsonBody(run))
      .executeTest(async (server) => {
        routeApiTo(server.url)
        await expect(api.startRun()).resolves.toMatchObject({ id: RUN_ID, depth: 1, oil: 20, probes: [] })
      })
  })

  test('reprendre une expédition en cours', async () => {
    await pact
      .addInteraction()
      .given('une expédition Prismine est en cours')
      .uponReceiving('la reprise d’une expédition')
      .withRequest('GET', currentRun())
      .willRespondWith(200, (res) => res.jsonBody(run))
      .executeTest(async (server) => {
        routeApiTo(server.url)
        await expect(api.getRun(RUN_ID)).resolves.toMatchObject({ id: RUN_ID, oil: 20 })
      })
  })

  test('une expédition inconnue répond 404 avec un message', async () => {
    await pact
      .addInteraction()
      .given('aucune expédition Prismine dans cette session')
      .uponReceiving('la lecture d’une expédition inconnue')
      .withRequest('GET', `${ROOT}/${RUN_ID}`)
      .willRespondWith(404, (res) => res.jsonBody({ error: like('Cette expédition n’existe plus.') }))
      .executeTest(async (server) => {
        routeApiTo(server.url)
        await expect(api.getRun(RUN_ID)).rejects.toMatchObject({ status: 404 })
      })
  })

  test('envoyer un faisceau ajoute un tir au journal', async () => {
    await pact
      .addInteraction()
      .given('une expédition Prismine est en cours')
      .uponReceiving('un tir sur un bord de la galerie')
      .withRequest('POST', currentRun('/probes'), (req) => req.headers(headers).jsonBody({ entry: 0 }))
      .willRespondWith(200, (res) => res.jsonBody({ ...run, probes: eachLike(probe) }))
      .executeTest(async (server) => {
        routeApiTo(server.url)
        const view = await api.probe(RUN_ID, 0)
        expect(view.probes).toHaveLength(1)
        expect(view.probes[0]).toMatchObject({ entry: 0, revealed: false })
      })
  })

  test('un tir hors de la galerie répond 400 avec un message', async () => {
    await pact
      .addInteraction()
      .given('une expédition Prismine est en cours')
      .uponReceiving('un tir hors de la galerie')
      .withRequest('POST', currentRun('/probes'), (req) => req.headers(headers).jsonBody({ entry: 999 }))
      .willRespondWith(400, (res) => res.jsonBody({ error: like('Ce bord n’existe pas.') }))
      .executeTest(async (server) => {
        routeApiTo(server.url)
        await expect(api.probe(RUN_ID, 999)).rejects.toMatchObject({ status: 400 })
      })
  })

  test('une carte illisible répond 400 sur le champ guess', async () => {
    await pact
      .addInteraction()
      .given('une expédition Prismine est en cours')
      .uponReceiving('une carte contenant une pièce inconnue')
      .withRequest('POST', currentRun('/validation'), (req) => req.headers(headers).jsonBody({ guess: '//' }))
      .willRespondWith(400, (res) => res.jsonBody({ fields: { guess: like('La carte contient une pièce inconnue.') } }))
      .executeTest(async (server) => {
        routeApiTo(server.url)
        await expect(api.validate(RUN_ID, '//')).rejects.toMatchObject({
          status: 400,
          fields: { guess: expect.any(String) },
        })
      })
  })

  test('terminer une expédition dévoile la carte, sans score pour un invité', async () => {
    await pact
      .addInteraction()
      .given('une expédition Prismine est en cours')
      .uponReceiving('la fin d’une expédition d’invité')
      .withRequest('POST', currentRun('/end'), (req) => req.headers(headers).jsonBody({}))
      .willRespondWith(200, (res) => res.jsonBody({ floor, run, recorded: false }))
      .executeTest(async (server) => {
        routeApiTo(server.url)
        await expect(api.endRun(RUN_ID)).resolves.toMatchObject({ recorded: false, run: { id: RUN_ID } })
      })
  })
})
