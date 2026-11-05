// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { playMove, readMatch, startMatch } from './api'
import { INITIAL, MOVE, NEXT } from './test-fixtures'

vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }))
const fetchStub = vi.fn<typeof fetch>()
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

beforeEach(() => {
  fetchStub.mockReset()
  vi.stubGlobal('fetch', fetchStub)
  document.cookie = 'XSRF-TOKEN=jeton-dames'
})
afterEach(() => vi.unstubAllGlobals())

test('crée avec les deux noms, le cookie de session et le jeton CSRF du socle', async () => {
  fetchStub.mockResolvedValue(response(INITIAL, 201))
  await expect(startMatch({ whiteName: 'Chérif', blackName: 'Amadou' })).resolves.toEqual(INITIAL)
  expect(fetchStub).toHaveBeenCalledWith('/api/games/dame/matches', {
    credentials: 'same-origin',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': 'jeton-dames' },
    body: JSON.stringify({ whiteName: 'Chérif', blackName: 'Amadou' }),
  })
})

test('relit uniquement la rencontre identifiée, sans renvoyer de plateau', async () => {
  fetchStub.mockResolvedValue(response(NEXT))
  await expect(readMatch(INITIAL.id)).resolves.toEqual(NEXT)
  expect(fetchStub).toHaveBeenCalledWith(`/api/games/dame/matches/${INITIAL.id}`, { credentials: 'same-origin' })
})

test('envoie seulement la version, l’origine et le parcours du coup', async () => {
  fetchStub.mockResolvedValue(response(NEXT))
  await expect(playMove(INITIAL.id, 0, MOVE)).resolves.toEqual(NEXT)
  expect(JSON.parse(fetchStub.mock.calls[0][1]!.body as string)).toEqual({ version: 0, ...MOVE })
  expect(fetchStub.mock.calls[0][0]).toBe(`/api/games/dame/matches/${INITIAL.id}/moves`)
})

test.each([400, 403, 404, 409, 502])('conserve le statut %i et le message du serveur', async (status) => {
  fetchStub.mockResolvedValue(response({ error: 'Réessaie.' }, status))
  await expect(playMove(INITIAL.id, 0, MOVE)).rejects.toMatchObject({ status, message: 'Réessaie.' })
})
