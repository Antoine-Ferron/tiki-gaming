const TABLES = '/api/games/bang/tables'

export function startTable(players, client) {
  const code = client.post(players[0], TABLES, 'setup').body.code
  const path = `${TABLES}/${code}`
  for (const player of players.slice(1)) client.post(player, `${path}/join`, 'setup')
  client.post(players[0], `${path}/start`, 'setup')
  const views = players.map((player) => client.get(player, `${path}/state`, 'setup').body)
  return { code, players, views }
}
