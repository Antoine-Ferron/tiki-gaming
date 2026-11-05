// Contrat front → backend Java (consumer-driven, Pact V4). Chaque interaction décrit une requête que le front
// envoie vraiment (adaptateurs et client HTTP réels) et la réponse minimale dont il a besoin. Les matchers
// (like, integer…) fixent la forme, pas la valeur : le backend reste libre de ses données.
import path from 'node:path'
import { MatchersV3, PactV4 } from '@pact-foundation/pact'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { supabaseScores } from '@/games/adapters/supabase'
import { GameError } from '@/games/errors'
import { destinations, play } from '@/games/echecs/api'
import { serverVerifier } from '@/games/rush-hour/services/levelVerifier'
import { ApiError, apiDelete } from '@/lib/api'
import { clearSession, fetchSession } from '@/lib/session'
import { accept, dodge, fire, getView, joinTable } from '@/games/bang/api'

const { like, eachLike, integer, regex } = MatchersV3

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
  describe('invité BANG! sans compte', () => {
    test('rejoindre avec le CSRF renvoie la place attribuée par la session', async () => {
      await pact
        .addInteraction()
        .given('une table BANG! est ouverte aux invités')
        .uponReceiving('la jonction BANG! d’un invité sans compte')
        .withRequest('POST', '/api/games/bang/tables/ABC123/join', (req) =>
          req.headers({ 'Content-Type': 'application/json', ...csrfHeader }).jsonBody({}),
        )
        .willRespondWith(200, (res) =>
          res.jsonBody({ code: like('ABC123'), seat: integer(3), playerCount: integer(3) }),
        )
        .executeTest(async (server) => {
          routeApiTo(server.url)
          await expect(joinTable('ABC123')).resolves.toEqual({ code: 'ABC123', seat: 3, playerCount: 3 })
        })
    })

    test('la session invitée lit sa main et son rôle privés sans compte', async () => {
      const view = {
        code: 'ABC123',
        seat: 3,
        currentSeat: 1,
        phase: 'PLAY',
        role: 'OUTLAW',
        hand: [{ id: 'MISSED-7', type: 'MISSED' }],
        players: ['WILLY_THE_KID', 'BART_CASSIDY', 'CALAMITY_JANET', 'PAUL_REGRET'].map((character, index) => ({
          seat: index + 1,
          character,
          health: index === 0 ? 5 : index === 3 ? 3 : 4,
          maxHealth: index === 0 ? 5 : index === 3 ? 3 : 4,
          playedCards: [],
          handCount: index === 2 ? 1 : 4,
          ...(index === 0 ? { role: 'SHERIFF' } : {}),
        })),
      }
      await pact
        .addInteraction()
        .given('un invité est assis à la table BANG!')
        .uponReceiving('la lecture privée BANG! d’un invité sans compte')
        .withRequest('GET', '/api/games/bang/tables/ABC123/state')
        .willRespondWith(200, (res) => res.jsonBody(like(view)))
        .executeTest(async (server) => {
          routeApiTo(server.url)
          await expect(getView('ABC123')).resolves.toEqual(view)
        })
    })
  })

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

  // Rush Hour : le serveur rejoue les coups d'un niveau et calcule lui-même le score (anti-triche, S6). Le front
  // appelle le vrai adaptateur du jeu (serverVerifier) ; les états « visiteur » suffisent, le calcul n'a besoin de
  // rien d'autre que les coups.
  describe('POST /api/games/rush-hour/levels/{level}/results', () => {
    // Solution du niveau 1 en 3 coups (shared/games/rush-hour/contrat.json)
    const LEVEL_1_SOLUTION = [
      { id: 'A', delta: 3 },
      { id: 'H', delta: -1 },
      { id: 'X', delta: 3 },
    ]

    test('une partie gagnée est rejouée par le serveur, qui renvoie le score, les coups et le minimum', async () => {
      await pact
        .addInteraction()
        .given('aucun joueur n’est connecté')
        .uponReceiving('la vérification d’une partie gagnée du niveau 1 de Rush Hour')
        .withRequest('POST', '/api/games/rush-hour/levels/1/results', (req) =>
          req.headers({ 'Content-Type': 'application/json', ...csrfHeader }).jsonBody({
            moves: [
              { vehicle: 'A', delta: 3 },
              { vehicle: 'H', delta: -1 },
              { vehicle: 'X', delta: 3 },
            ],
            hints: 0,
          }),
        )
        .willRespondWith(200, (res) => res.jsonBody({ score: integer(1000), moves: integer(3), optimal: integer(3) }))
        .executeTest(async (server) => {
          routeApiTo(server.url)
          await expect(serverVerifier(1, { moves: LEVEL_1_SOLUTION, hintsUsed: 0 })).resolves.toEqual({
            score: 1000,
            moves: 3,
            optimal: 3,
          })
        })
    })

    test('une partie truquée est refusée (422) avec un message que le jeu affiche', async () => {
      await pact
        .addInteraction()
        .given('aucun joueur n’est connecté')
        .uponReceiving('la vérification d’une partie truquée du niveau 1 de Rush Hour')
        .withRequest('POST', '/api/games/rush-hour/levels/1/results', (req) =>
          req
            .headers({ 'Content-Type': 'application/json', ...csrfHeader })
            .jsonBody({ moves: [{ vehicle: 'X', delta: 3 }], hints: 0 }),
        )
        .willRespondWith(422, (res) =>
          res.jsonBody({ error: like('Partie refusée : Déplacement impossible : X de 3') }),
        )
        .executeTest(async (server) => {
          routeApiTo(server.url)
          const refusal = await serverVerifier(1, { moves: [{ id: 'X', delta: 3 }], hintsUsed: 0 }).catch(
            (err: unknown) => err,
          )
          expect(refusal).toBeInstanceOf(ApiError)
          expect(refusal).toMatchObject({ status: 422, message: 'Partie refusée : Déplacement impossible : X de 3' })
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

  describe('API des échecs (sans état : le front envoie la FEN)', () => {
    const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

    test('les cases accessibles d’une pièce', async () => {
      await pact
        .addInteraction()
        .given('aucun joueur n’est connecté')
        .uponReceiving('la demande des cases accessibles du pion e2')
        .withRequest('POST', '/api/games/echecs/destinations', (req) =>
          req.headers({ 'Content-Type': 'application/json', ...csrfHeader }).jsonBody({ fen: START, from: 'e2' }),
        )
        .willRespondWith(200, (res) => res.jsonBody({ destinations: eachLike('e3') }))
        .executeTest(async (server) => {
          routeApiTo(server.url)
          await expect(destinations(START, 'e2')).resolves.toEqual(['e3'])
        })
    })

    test('un coup joué renvoie la nouvelle position', async () => {
      await pact
        .addInteraction()
        .given('aucun joueur n’est connecté')
        .uponReceiving('le coup e2-e4 depuis la position de départ')
        .withRequest('POST', '/api/games/echecs/moves', (req) =>
          req
            .headers({ 'Content-Type': 'application/json', ...csrfHeader })
            .jsonBody({ fen: START, from: 'e2', to: 'e4' }),
        )
        .willRespondWith(200, (res) =>
          res.jsonBody({
            fen: like('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1'),
            status: like('ONGOING'),
          }),
        )
        .executeTest(async (server) => {
          routeApiTo(server.url)
          await expect(play(START, 'e2', 'e4')).resolves.toEqual({
            fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
            status: 'ONGOING',
          })
        })
    })

    test('un coup interdit est refusé (422) avec un message pour le joueur', async () => {
      await pact
        .addInteraction()
        .given('aucun joueur n’est connecté')
        .uponReceiving('le coup interdit e2-e5 depuis la position de départ')
        .withRequest('POST', '/api/games/echecs/moves', (req) =>
          req
            .headers({ 'Content-Type': 'application/json', ...csrfHeader })
            .jsonBody({ fen: START, from: 'e2', to: 'e5' }),
        )
        .willRespondWith(422, (res) =>
          res.jsonBody({ error: like('Coup refusé : Case inaccessible pour la pièce en e2 : e5') }),
        )
        .executeTest(async (server) => {
          routeApiTo(server.url)
          const refusal = await play(START, 'e2', 'e5').catch((err: unknown) => err)
          expect(refusal).toBeInstanceOf(ApiError)
          expect(refusal).toMatchObject({ status: 422 })
        })
    })
  })
})
