import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import { startTable, playTurn } from './bang-session.js'

test('démarre une table avec quatre sessions distinctes et leurs vues privées', () => {
  const players = [1, 2, 3, 4].map((seat) => ({ seat }))
  const views = players.map(({ seat }) => ({ code: 'TABLE', seat, currentSeat: 1, phase: 'DRAW', hand: [] }))
  const client = {
    post: mock.fn((player, path) => ({ status: path === '/api/games/bang/tables' ? 201 : 200, body: { code: 'TABLE', seat: player.seat } })),
    get: mock.fn((player) => ({ status: 200, body: views[player.seat - 1] })),
  }

  const table = startTable(players, client)

  assert.equal(table.code, 'TABLE')
  assert.deepEqual(table.views, views)
  assert.deepEqual(client.post.mock.calls.map(({ arguments: [player, path] }) => [player.seat, path]), [
    [1, '/api/games/bang/tables'],
    [2, '/api/games/bang/tables/TABLE/join'],
    [3, '/api/games/bang/tables/TABLE/join'],
    [4, '/api/games/bang/tables/TABLE/join'],
    [1, '/api/games/bang/tables/TABLE/start'],
  ])
})

test('un démarrage refusé fait échouer la charge au lieu de compter une table prête', () => {
  const players = [1, 2, 3, 4].map((seat) => ({ seat }))
  const client = {
    post: mock.fn((player, path) => ({ status: path.endsWith('/start') ? 409 : path.endsWith('/tables') ? 201 : 200, body: { code: 'TABLE' } })),
    get: mock.fn(() => ({ status: 200, body: {} })),
  }

  assert.throws(() => startTable(players, client), /409/)
  assert.equal(client.get.mock.callCount(), 0)
})

function turnFixture() {
  const players = [1, 2, 3, 4].map((seat) => ({ seat }))
  const initial = players.map(({ seat }) => ({ code: 'TABLE', seat, currentSeat: 1, phase: 'DRAW',
    hand: [{ id: `card-${seat}`, type: 'BANG' }], players: [{ seat: 1, health: 1 }] }))
  const drawn = { ...initial[0], phase: 'PLAY', hand: [...initial[0].hand, { id: 'draw-1', type: 'BANG' }, { id: 'draw-2', type: 'MISSED' }] }
  const final = initial.map((view) => ({ ...view, currentSeat: 2, phase: 'DRAW',
    hand: view.seat === 1 ? [drawn.hand[2]] : view.hand }))
  const client = {
    post: mock.fn(() => ({ status: 204 })),
    get: mock.fn(() => ({ status: 200, body: replies.shift() })),
  }
  const replies = [drawn, ...final]
  return { table: { code: 'TABLE', players, views: initial }, client, final }
}

test('joue un tour valide et vérifie le passage et chaque main', () => {
  const { table, client, final } = turnFixture()
  const views = playTurn(table, client)
  assert.deepEqual(views, final)
  assert.deepEqual(client.post.mock.calls.map(({ arguments: [player, path] }) => [player.seat, path]), [
    [1, '/api/games/bang/tables/TABLE/turn/draw'],
    [1, '/api/games/bang/tables/TABLE/turn/end'],
    [1, '/api/games/bang/tables/TABLE/turn/discard/card-1'],
    [1, '/api/games/bang/tables/TABLE/turn/discard/draw-1'],
    [1, '/api/games/bang/tables/TABLE/turn/end'],
  ])
})
