// Contrat front → backend Java (consumer-driven, Pact V4). Chaque interaction décrit une requête que le front
// envoie vraiment (adaptateurs et client HTTP réels) et la réponse minimale dont il a besoin. Les matchers
// (like, integer…) fixent la forme, pas la valeur : le backend reste libre de ses données.
import path from 'node:path'
import { MatchersV3, PactV4 } from '@pact-foundation/pact'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { supabaseScores } from '@/games/adapters/supabase'
import { GameError } from '@/games/errors'
import { apiDelete } from '@/lib/api'
import { clearSession, fetchSession } from '@/lib/session'
import { accept, dodge, fire } from '@/games/bang/api'

const { like, integer, regex } = MatchersV3

vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn() } }))

const pact = new PactV4({
  consumer: 'tiki-frontend',
  provider: 'tiki-backend',
  dir: path.resolve(import.meta.dirname, '../../pacts'),
  logLevel: 'warn',
})

// Le front envoie le jeton lu dans le cookie XSRF-TOKEN ; le backend le vérifie (sa valeur change à chaque session).
const CSRF = 'jeton-csrf-de-test'
const csrfHeader = { 'X-XSRF-TOKEN': like(CSRF) }
const UUID = regex(/^[0-9a-f-]{36}$/.source, '7c9e6679-7425-40de-944b-e07fc1f90ae7')

/** Le front appelle `/api/...` sur sa propre origine : on redirige ces appels vers le faux backend de Pact. */
function routeApiTo(url: string) {
  const realFetch = globalThis.fetch
  vi.stubGlobal('fetch', (input: string, init?: RequestInit) => realFetch(`${url}${input}`, init))
}

beforeEach(() => {
  document.cookie = `XSRF-TOKEN=${CSRF}`
  clearSession()
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('contrat front → backend', () => {
  describe('actions de tir BANG!', () => {
    test.each([
      { action: 'tirer', path: '/shots/BANG-1/targets/2', send: () => fire('ABC123', 'BANG-1', 2) },
      {
        action: 'esquiver',
        path: '/shots/tir-courant/dodge/MISSED-1',
        send: () => dodge('ABC123', 'tir-courant', 'MISSED-1'),
      },
      { action: 'accepter', path: '/shots/tir-courant/accept', send: () => accept('ABC123', 'tir-courant') },
    ])('$action utilise la route serveur et le CSRF du dépôt', async ({ action, path: route, send }) => {
      await pact
        .addInteraction()
        .given('un joueur est connecté')
        .uponReceiving(`l’action BANG! ${action}`)
        .withRequest('POST', `/api/games/bang/tables/ABC123${route}`, (req) =>
          req.headers({ 'Content-Type': 'application/json', ...csrfHeader }).jsonBody({}),
        )
        .willRespondWith(204)
        .executeTest(async (server) => {
          routeApiTo(server.url)
          await expect(send()).resolves.toBeUndefined()
        })
    })
  })
  describe('POST /api/scores', () => {
    test('un joueur connecté enregistre le score de sa partie', async () => {
      await pact
        .addInteraction()
        .given('un joueur est connecté')
        .uponReceiving('l’envoi du score d’une partie terminée')
        .withRequest('POST', '/api/scores', (req) =>
          req
            .headers({ 'Content-Type': 'application/json', ...csrfHeader })
            .jsonBody({ gameSlug: like('clicker'), score: integer(120), metadata: like({ durationMs: 10000 }) }),
        )
        .willRespondWith(204)
        .executeTest(async (server) => {
          routeApiTo(server.url)
          await expect(supabaseScores.insert('clicker', 120, { durationMs: 10000 })).resolves.toBeUndefined()
        })
    })

    test('un score au-dessus du maximum est refusé avec un message pour le joueur', async () => {
      await pact
        .addInteraction()
        .given('un joueur est connecté')
        .uponReceiving('l’envoi d’un score au-dessus du maximum du jeu')
        .withRequest('POST', '/api/scores', (req) =>
          req
            .headers({ 'Content-Type': 'application/json', ...csrfHeader })
            .jsonBody({ gameSlug: 'clicker', score: 301, metadata: {} }),
        )
        .willRespondWith(400, (res) => res.jsonBody({ error: like('Score refusé : il dépasse le maximum de ce jeu.') }))
        .executeTest(async (server) => {
          routeApiTo(server.url)
          const refusal = await supabaseScores.insert('clicker', 301, {}).catch((err: unknown) => err)
          expect(refusal).toBeInstanceOf(GameError)
          expect(refusal).toMatchObject({ code: 'invalid', message: 'Score refusé : il dépasse le maximum de ce jeu.' })
        })
    })

    test('sans session, le score est refusé (401) et le front le garde comme une session perdue', async () => {
      await pact
        .addInteraction()
        .given('aucun joueur n’est connecté')
        .uponReceiving('l’envoi d’un score sans session')
        .withRequest('POST', '/api/scores', (req) =>
          req
            .headers({ 'Content-Type': 'application/json', ...csrfHeader })
            .jsonBody({ gameSlug: 'clicker', score: 120, metadata: {} }),
        )
        .willRespondWith(401, (res) => res.jsonBody({ error: like('Connecte-toi pour enregistrer ton score.') }))
        .executeTest(async (server) => {
          routeApiTo(server.url)
          await expect(supabaseScores.insert('clicker', 120, {})).rejects.toMatchObject({ code: 'session' })
        })
    })
  })

  describe('GET /api/auth/session', () => {
    test('un visiteur n’a ni utilisateur ni jeton', async () => {
      await pact
        .addInteraction()
        .given('aucun joueur n’est connecté')
        .uponReceiving('la lecture de la session d’un visiteur')
        .withRequest('GET', '/api/auth/session')
        .willRespondWith(200, (res) => res.jsonBody({ user: null }))
        .executeTest(async (server) => {
          routeApiTo(server.url)
          await expect(fetchSession()).resolves.toEqual({ user: null })
        })
    })

    test('un joueur connecté reçoit son compte et un JWT Supabase avec son expiration', async () => {
      await pact
        .addInteraction()
        .given('un joueur est connecté')
        .uponReceiving('la lecture de la session d’un joueur connecté')
        .withRequest('GET', '/api/auth/session')
        .willRespondWith(200, (res) =>
          res.jsonBody({
            user: { id: UUID, email: like('joueur@example.com') },
            accessToken: like('eyJhbGciOiJIUzI1NiJ9.e30.signature'),
            expiresAt: integer(1_793_000_000_000),
          }),
        )
        .executeTest(async (server) => {
          routeApiTo(server.url)
          const session = await fetchSession()
          expect(session.user).toEqual({ id: '7c9e6679-7425-40de-944b-e07fc1f90ae7', email: 'joueur@example.com' })
          expect(typeof session.accessToken).toBe('string')
          expect(typeof session.expiresAt).toBe('number')
        })
    })
  })

  describe('DELETE /api/auth/account', () => {
    test('un joueur connecté supprime son compte (RGPD)', async () => {
      await pact
        .addInteraction()
        .given('un joueur est connecté')
        .uponReceiving('la suppression du compte du joueur')
        .withRequest('DELETE', '/api/auth/account', (req) => req.headers(csrfHeader))
        .willRespondWith(204)
        .executeTest(async (server) => {
          routeApiTo(server.url)
          await expect(apiDelete('/auth/account')).resolves.toBeUndefined()
        })
    })
  })
})
