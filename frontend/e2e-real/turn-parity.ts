import { expect, test, type APIRequest } from '@playwright/test'
import { deal, discard, draw, endTurn, viewOf, type Shuffle } from '../src/games/bang/local'

/** Même mélange que BangBrowserApplication ; les contrats de cartes restent ceux des deux moteurs. */
const ordered: Shuffle = (items) => {
  if (typeof items[0] === 'object') return [...items.slice(20), ...items.slice(0, 20)]
  if (items[0] === 'bart-cassidy') return [items[3], ...items.slice(0, 3)]
  return items
}

export async function compareLocalAndOnlineTurn(request: APIRequest, baseURL: string) {
  const sessions = await Promise.all([1, 2, 3, 4].map(() => request.newContext({ baseURL })))
  try {
    const post = async (seat: number, path: string, status: number) => {
      const token = (await sessions[seat - 1].storageState()).cookies.find((cookie) => cookie.name === 'XSRF-TOKEN')!
      const response = await sessions[seat - 1].post(path, {
        headers: { 'X-XSRF-TOKEN': decodeURIComponent(token.value) },
        data: {},
      })
      expect(response.status()).toBe(status)
      return response
    }
    for (const session of sessions) expect((await session.get('/api/auth/session')).status()).toBe(200)
    const { code } = await (await post(1, '/api/games/bang/tables', 201)).json()
    const table = `/api/games/bang/tables/${code}`
    for (const seat of [2, 3, 4]) await post(seat, `${table}/join`, 200)
    await post(1, `${table}/start`, 200)
    let local = deal(ordered)
    const observed: unknown[] = []
    const compare = async (stage: string) => {
      for (const seat of [1, 2]) {
        const expected = viewOf(local, seat)
        const response = await sessions[seat - 1].get(`${table}/state`)
        expect(response.status()).toBe(200)
        const actual = await response.json()
        const snapshot = { currentSeat: actual.currentSeat, phase: actual.phase, hand: actual.hand }
        expect(snapshot, `${stage}, vue du siège ${seat}`).toEqual({
          currentSeat: expected.currentSeat,
          phase: expected.phase,
          hand: expected.hand,
        })
        observed.push({ stage, seat, ...snapshot })
      }
    }
    const command = async (path: string) => {
      await post(1, `${table}/turn/${path}`, 204)
    }
    await compare('donne')
    local = draw(local, ordered)
    await command('draw')
    await compare('pioche')
    local = endTurn(local)
    await command('end')
    await compare('fin de phase de jeu')
    for (let index = 0; index < 2; index++) {
      const card = local.players[0].hand[0]
      local = discard(local, card.id)
      await command(`discard/${encodeURIComponent(card.id)}`)
      await compare(`défausse ${index + 1}`)
    }
    local = endTurn(local)
    await command('end')
    await compare('passage au siège 2')
    await test
      .info()
      .attach('meme-tour-local-en-ligne', { body: JSON.stringify(observed, null, 2), contentType: 'application/json' })
  } finally {
    await Promise.all(sessions.map((session) => session.dispose()))
  }
}
