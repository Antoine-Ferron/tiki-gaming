// Charge BANG! sur le backend local de quality/. Les quatre sessions de chaque table sont des invités.
import { sleep } from 'k6'
import http from 'k6/http'
import exec from 'k6/execution'
import { Counter } from 'k6/metrics'
import { startTable, playTurn } from './bang-session.js'

const BASE = __ENV.BACKEND_URL || 'http://host.docker.internal:8080'
const PROFILE = __ENV.PROFILE || 'load'
const PROFILES = { smoke: { tables: 1, seconds: 6 }, load: { tables: 10, seconds: 30 } }
const profile = PROFILES[PROFILE]
if (!profile) throw new Error(`Profil BANG! inconnu : ${PROFILE}`)

const started = new Counter('bang_tables_started')
const played = new Counter('bang_tables_played')

export const options = {
  scenarios: {
    tables: { executor: 'constant-vus', vus: profile.tables, duration: `${profile.seconds}s`, gracefulStop: '5s' },
  },
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(95)', 'p(99)'],
  thresholds: {
    'http_req_duration{kind:read}': ['p(95)<300', 'p(99)<500'],
    'http_req_duration{kind:command}': ['p(95)<300', 'p(99)<500'],
    'http_req_failed{kind:read}': ['rate<0.01'],
    'http_req_failed{kind:command}': ['rate<0.01'],
    'http_reqs{kind:read}': [`count>=${((profile.tables * 4 * profile.seconds) / 2) * 0.95}`],
    'http_reqs{kind:command}': [`count==${profile.tables * 5}`],
    bang_tables_started: [`count==${profile.tables}`],
    bang_tables_played: [`count==${profile.tables}`],
  },
}

const cookies = (player) => player.jar.cookiesForURL(BASE)
const client = {
  get(player, path, kind) {
    return send(player, 'GET', path, kind)
  },
  post(player, path, kind) {
    return send(player, 'POST', path, kind)
  },
}

function send(player, method, path, kind) {
  const headers = { 'Content-Type': 'application/json' }
  if (method === 'POST') headers['X-XSRF-TOKEN'] = decodeURIComponent(cookies(player)['XSRF-TOKEN'][0])
  const response = http.request(method, BASE + path, method === 'POST' ? '{}' : null, {
    jar: player.jar,
    headers,
    tags: { kind, name: `${method} BANG! ${kind}` },
  })
  return { status: response.status, body: response.body ? response.json() : null }
}

export function setup() {
  const tables = []
  for (let index = 0; index < profile.tables; index++) {
    const players = Array.from({ length: 4 }, () => ({ jar: new http.CookieJar() }))
    for (const player of players) {
      if (client.get(player, '/api/auth/session', 'setup').status !== 200) throw new Error('Session indisponible')
    }
    const table = startTable(players, client)
    tables.push({ ...table, players: players.map((player) => ({ cookies: cookies(player) })) })
    started.add(1)
  }
  if (new Set(tables.map((table) => table.code)).size !== profile.tables) throw new Error('Tables non distinctes')
  const identities = tables.flatMap((table) => table.players.map((player) => player.cookies.JSESSIONID[0]))
  if (new Set(identities).size !== profile.tables * 4) throw new Error('Sessions non isolées')
  return tables
}

let ownTable
export default function (tables) {
  const began = Date.now()
  if (!ownTable) {
    const table = tables[exec.vu.idInTest - 1]
    ownTable = {
      ...table,
      players: table.players.map((saved) => {
        const jar = new http.CookieJar()
        for (const [name, values] of Object.entries(saved.cookies)) jar.set(BASE, name, values[0], { path: '/' })
        return { jar }
      }),
    }
  }
  for (const [index, player] of ownTable.players.entries()) {
    const response = client.get(player, `/api/games/bang/tables/${ownTable.code}/state`, 'read')
    if (response.status !== 200 || response.body.seat !== index + 1) throw new Error('Vue privée indisponible')
  }
  if (exec.vu.iterationInScenario === 0) {
    playTurn(ownTable, client)
    played.add(1)
  }
  sleep(Math.max(0, 2 - (Date.now() - began) / 1000))
}

export function handleSummary(data) {
  const metric = (name) => data.metrics[name]?.values || {}
  const measurements = (kind) => ({
    requests: metric(`http_reqs{kind:${kind}}`).count || 0,
    requestsPerSecond: metric(`http_reqs{kind:${kind}}`).rate || 0,
    p95Ms: metric(`http_req_duration{kind:${kind}}`)['p(95)'],
    p99Ms: metric(`http_req_duration{kind:${kind}}`)['p(99)'],
    errorRate: metric(`http_req_failed{kind:${kind}}`).rate || 0,
  })
  const report = {
    profile: PROFILE,
    seconds: profile.seconds,
    tablesExpected: profile.tables,
    tablesStarted: metric('bang_tables_started').count || 0,
    tablesPlayed: metric('bang_tables_played').count || 0,
    reads: measurements('read'),
    commands: measurements('command'),
    raw: data,
  }
  return {
    stdout: JSON.stringify({ ...report, raw: undefined }, null, 2) + '\n',
    [`/quality/reports/bang/k6-${PROFILE}.json`]: JSON.stringify(report, null, 2),
  }
}
