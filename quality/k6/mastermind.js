// Charge ciblée des endpoints Mastermind.
// PROFILE=load docker compose -f quality/docker-compose.yml run --rm k6 run /quality/k6/mastermind.js
import { check } from 'k6'
import http from 'k6/http'

const BASE_URL = __ENV.BACKEND_URL || 'http://host.docker.internal:8080'
const rate = Number(__ENV.MASTERMIND_RATE || 10)

// seuils des endpoints Mastermind
export const options = {
  scenarios: {
    mastermind: {
      executor: 'constant-arrival-rate',
      rate,
      timeUnit: '1s',
      duration: __ENV.DURATION || '30s',
      preAllocatedVUs: 10,
      maxVUs: 100,
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<300', 'p(99)<500'],
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.99'],
  },
}

export default function () {
  const created = http.post(`${BASE_URL}/api/games/mastermind`, null, { tags: { name: 'POST /games/mastermind' } })
  check(created, { 'création : 201': (response) => response.status === 201 })
  if (created.status !== 201) return

  const id = created.json('id')
  const loaded = http.get(`${BASE_URL}/api/games/mastermind/${id}`, {
    tags: { name: 'GET /games/mastermind/:id' },
  })
  check(loaded, {
    'lecture : 200 et secret masqué': (response) => response.status === 200 && response.json('secret') === null,
  })

  const guessed = http.post(
    `${BASE_URL}/api/games/mastermind/${id}/guesses`,
    JSON.stringify({ colors: ['red', 'red', 'red', 'red'] }),
    { headers: { 'Content-Type': 'application/json' }, tags: { name: 'POST /games/mastermind/:id/guesses' } },
  )
  check(guessed, { 'proposition : réponse HTTP': (response) => response.status === 200 || response.status === 409 })
  // erreurs sous 1 pour cent : le threshold global http_req_failed est bloquant.
}
