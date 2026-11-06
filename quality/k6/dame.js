// Environnement de démonstration uniquement : chaque itération crée une rencontre.
import { check, sleep } from 'k6'
import http from 'k6/http'

const base = __ENV.BACKEND_URL || 'http://host.docker.internal:8080'
const profile = __ENV.PROFILE || 'smoke'
if (!['smoke', 'load'].includes(profile)) throw new Error('PROFILE attendu : smoke ou load')

export const options = {
  scenarios: {
    dame: {
      executor: 'constant-vus',
      vus: profile === 'smoke' ? 1 : 10,
      duration: __ENV.DURATION || (profile === 'smoke' ? '10s' : '1m'),
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    checks: ['rate==1'],
    'http_req_duration{operation:create}': ['p(95)<300'],
    'http_req_duration{operation:read}': ['p(95)<300'],
    'http_req_duration{operation:move}': ['p(95)<300'],
  },
}

function params(operation, token) {
  return {
    tags: { operation, name: `dame/${operation}` },
    headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': token },
    timeout: '5s',
  }
}

export default function () {
  const jar = http.cookieJar()
  jar.clear(base) // Un navigateur isolé par parcours, sans dépendre de l'itération précédente.
  const session = http.get(`${base}/api/auth/session`, params('session', ''))
  if (!check(session, { 'session initialisée': (r) => r.status === 200 })) return
  const token = jar.cookiesForURL(base)['XSRF-TOKEN']?.[0]
  if (!check(token, { 'jeton CSRF reçu': (value) => Boolean(value) })) return

  const created = http.post(
    `${base}/api/games/dame/matches`,
    JSON.stringify({ whiteName: 'Charge blanc', blackName: 'Charge noir' }),
    params('create', token),
  )
  if (!check(created, { 'création : 201': (r) => r.status === 201 })) return
  const initial = created.json()
  const url = `${base}/api/games/dame/matches/${initial.id}`
  const loaded = http.get(url, params('read', token))
  if (!check(loaded, { 'relecture identique': (r) => r.status === 200 && r.json('id') === initial.id && r.json('version') === 0 })) return

  const move = initial.legalMoves[0]
  const played = http.post(`${url}/moves`, JSON.stringify({ version: 0, ...move }), params('move', token))
  check(played, {
    'coup accepté une seule fois': (r) => r.status === 200 && r.json('version') === 1 && r.json('currentPlayer') === 'BLACK',
  })
  const after = http.get(url, params('read', token))
  check(after, { 'coup conservé': (r) => r.status === 200 && r.json('version') === 1 })
  sleep(0.5)
}
