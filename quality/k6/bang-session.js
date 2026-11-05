const TABLES = '/api/games/bang/tables'

function body(response, expected) {
  if (response.status !== expected) throw new Error(`HTTP ${response.status} au lieu de ${expected}`)
  return response.body
}

export function startTable(players, client) {
  const code = body(client.post(players[0], TABLES, 'setup'), 201).code
  const path = `${TABLES}/${code}`
  for (const player of players.slice(1)) body(client.post(player, `${path}/join`, 'setup'), 200)
  body(client.post(players[0], `${path}/start`, 'setup'), 200)
  const views = players.map((player) => body(client.get(player, `${path}/state`, 'setup'), 200))
  return { code, players, views }
}
