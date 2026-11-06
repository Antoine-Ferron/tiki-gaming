// Charge du serveur arbitre de Prismine : une expédition complète d'invité, sans navigateur.
// Lancement et résultats : docs/games/prismine/rapport-charge-k6.md
//   K6_PROFILE=load docker compose -f quality/docker-compose.yml run --rm k6 run --quiet /quality/k6/prismine.js
import { check } from 'k6'
import http from 'k6/http'

const BASE_URL = __ENV.BACKEND_URL || 'http://host.docker.internal:8080'
const RUNS = `${BASE_URL}/api/games/prismine/runs`
const PROFILE = __ENV.PROFILE || 'load'
const RATE = Number(__ENV.PRISMINE_RATE || 5) // expéditions par seconde en régime nominal
const DURATION = __ENV.DURATION || '30s'

const arrival = { timeUnit: '1s', preAllocatedVUs: 20, maxVUs: 200 }
const PROFILES = {
  smoke: { executor: 'shared-iterations', vus: 1, iterations: 5 },
  load: {
    executor: 'constant-arrival-rate',
    rate: RATE,
    duration: DURATION,
    ...arrival,
  },
  stress: {
    executor: 'ramping-arrival-rate',
    startRate: RATE,
    stages: [
      { duration: '30s', target: RATE * 2 },
      { duration: '30s', target: RATE * 4 },
      { duration: '30s', target: RATE * 8 },
    ],
    ...arrival,
  },
  spike: {
    executor: 'ramping-arrival-rate',
    startRate: RATE,
    stages: [
      { duration: '5s', target: RATE * 10 },
      { duration: '20s', target: RATE * 10 },
      { duration: '5s', target: RATE },
    ],
    ...arrival,
  },
}

export const options = {
  scenarios: { prismine: PROFILES[PROFILE] },
  summaryTrendStats: ['avg', 'med', 'max', 'p(95)', 'p(99)'],
  // Les SLO de docs/slo.md : un seuil dépassé fait sortir k6 en erreur et bloque la release.
  thresholds: {
    http_req_duration: ['p(95)<300', 'p(99)<500'],
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.99'],
  },
}

// Un bord déjà exploré répond 409 : c'est une règle du jeu, pas une panne.
const accepted = http.expectedStatuses(200, 201, 409)

function csrfHeaders() {
  const cookie = http.cookieJar().cookiesForURL(BASE_URL)['XSRF-TOKEN']
  return {
    'Content-Type': 'application/json',
    'X-XSRF-TOKEN': cookie ? cookie[0] : '',
  }
}

function send(path, body, name) {
  return http.post(`${RUNS}${path}`, JSON.stringify(body), {
    headers: csrfHeaders(),
    responseCallback: accepted,
    tags: { name },
  })
}

export default function () {
  // Pose les cookies de session et CSRF, comme à l'ouverture de la page.
  http.get(`${BASE_URL}/api/auth/session`, {
    tags: { name: 'GET /auth/session' },
  })

  const started = send('', {}, 'POST /runs')
  check(started, {
    'démarrage : 201, sans carte cachée': (r) => r.status === 201 && r.json('grid') === undefined,
  })
  if (started.status !== 201) return
  const { id, size } = started.json()

  const resumed = http.get(`${RUNS}/${id}`, {
    tags: { name: 'GET /runs/:id' },
  })
  check(resumed, { 'reprise : 200': (r) => r.status === 200 })

  for (const entry of [0, 1, 2]) {
    const probe = send(`/${id}/probes`, { entry }, 'POST /runs/:id/probes')
    check(probe, {
      'tir : 200 ou bord déjà exploré': (r) => r.status === 200 || r.status === 409,
    })
  }

  const verdict = send(`/${id}/validation`, { guess: '.'.repeat(size * size) }, 'POST /runs/:id/validation')
  check(verdict, { 'validation : 200': (r) => r.status === 200 })

  const ended = send(`/${id}/end`, {}, 'POST /runs/:id/end')
  check(ended, {
    'fin : 200 et pas de score pour un invité': (r) => r.status === 200 && r.json('recorded') === false,
  })
}

export function handleSummary(data) {
  return {
    [`/quality/reports/k6-prismine-${PROFILE}.json`]: JSON.stringify(data, null, 2),
  }
}
