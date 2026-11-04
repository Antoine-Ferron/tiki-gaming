// Tests de performance du lobby (k6). Cible l'environnement local de quality/docker-compose.yml, jamais la production.
//   docker run --rm --network host -v "$PWD/quality:/quality" grafana/k6:2.3.0 run /quality/k6/lobby.js
// Variables : PROFILE (voir PROFILES), REST_URL (PostgREST), BACKEND_URL (backend Java, scénario ignoré si vide),
// DURATION (palier principal), JWT_SECRET.
// Seuils = SLO de docs/slo.md : P95 < 300 ms, P99 < 500 ms, moins de 1 % d'erreurs. En CI : profil « load ».
import { check } from 'k6'
import exec from 'k6/execution'
import crypto from 'k6/crypto'
import encoding from 'k6/encoding'
import http from 'k6/http'

const REST_URL = __ENV.REST_URL || 'http://localhost:54330'
const BACKEND_URL = __ENV.BACKEND_URL || ''
const PROFILE = __ENV.PROFILE || 'load'
// Secret de l'environnement local (quality/docker-compose.yml), pas celui de la production.
const JWT_SECRET = __ENV.JWT_SECRET || 'tiki-quality-local-jwt-secret-0123456789'
const PLAYERS = 1000 // = PLAYERS de frontend/scripts/seed-quality.mjs

// `rate` = débit nominal du scénario (requêtes par seconde). Chaque profil le module selon son objectif.
const PROFILES = {
  // Santé minimale à froid : 1 utilisateur, quelques requêtes.
  smoke: () => ({
    executor: 'per-vu-iterations',
    vus: 1,
    iterations: 5,
    maxDuration: '30s',
  }),
  // Charge nominale constante : vérifie les SLO en régime de croisière (bloquant en CI).
  load: (rate) => ({
    ...arrival(rate),
    executor: 'constant-arrival-rate',
    rate,
    duration: __ENV.DURATION || '30s',
  }),
  // Montée continue jusqu'à 8× le nominal : trouve la charge maximale et le mode d'effondrement.
  stress: (rate) =>
    ramp(rate, [
      ['1m', 1],
      ['2m', 2],
      ['2m', 4],
      ['2m', 8],
      ['1m', 0],
    ]),
  // Pic brutal (×10 en 5 s) puis retour : vérifie que le service encaisse et se rétablit.
  spike: (rate) =>
    ramp(rate, [
      ['30s', 1],
      ['5s', 10],
      ['30s', 10],
      ['5s', 1],
      ['30s', 1],
    ]),
  // Charge modérée longue (2 h par défaut) : fuites mémoire, épuisement des pools de connexions.
  soak: (rate) => ({
    ...arrival(rate),
    executor: 'constant-arrival-rate',
    rate: Math.ceil(rate / 2),
    duration: __ENV.DURATION || '2h',
  }),
}

function arrival(rate) {
  return {
    timeUnit: '1s',
    preAllocatedVUs: 20,
    maxVUs: Math.max(100, rate * 10),
  }
}

function ramp(rate, stages) {
  return {
    ...arrival(rate * 8),
    executor: 'ramping-arrival-rate',
    startRate: rate,
    stages: stages.map(([duration, factor]) => ({
      duration,
      target: rate * factor,
    })),
  }
}

if (!PROFILES[PROFILE]) throw new Error(`PROFILE inconnu : ${PROFILE} (${Object.keys(PROFILES).join(', ')})`)

const scenario = (fn, rate) => ({ exec: fn, ...PROFILES[PROFILE](rate) })
const slo = (name) => ({
  [`http_req_duration{scenario:${name}}`]: ['p(95)<300', 'p(99)<500'],
})

export const options = {
  // P99 absent par défaut du résumé k6 : ajouté pour handleSummary et le rapport.
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
  scenarios: {
    // Chaque ouverture d'une page de jeu lit le classement (visiteur ou joueur).
    leaderboard: scenario('readLeaderboard', 100),
    // Fin de partie d'un joueur connecté : l'insertion que fait le backend (service_role, trigger max_score).
    submit_score: scenario('submitScore', 20),
    ...(BACKEND_URL ? { session: scenario('readSession', 50) } : {}),
  },
  thresholds: {
    ...slo('leaderboard'),
    ...slo('submit_score'),
    ...(BACKEND_URL ? slo('session') : {}),
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.99'],
  },
}

/** md5 → uuid, comme md5('k6-player-' || i)::uuid dans le jeu de données. */
function playerId(i) {
  const h = crypto.md5(`k6-player-${i}`, 'hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

/** JWT HS256 au format Supabase. */
function jwt(claims) {
  const b64 = (obj) => encoding.b64encode(JSON.stringify(obj), 'rawurl')
  const body = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ ...claims, exp: 4102444800 })}`
  return `${body}.${crypto.hmac('sha256', JWT_SECRET, body, 'base64rawurl')}`
}

export function setup() {
  return {
    players: Array.from({ length: PLAYERS }, (_, i) => playerId(i + 1)),
    // Clé du backend : les joueurs n'ont pas le droit d'insérer dans scores (POST /api/scores écrit pour eux).
    serviceRole: jwt({ role: 'service_role' }),
  }
}

export function readLeaderboard() {
  const res = http.get(`${REST_URL}/leaderboard?game_slug=eq.clicker&order=best_score.desc,username.asc&limit=10`, {
    tags: { name: 'GET /leaderboard' },
  })
  check(res, {
    'classement : 200 et 10 lignes': (r) => r.status === 200 && r.json().length === 10,
  })
}

export function submitScore(data) {
  // Joueurs et scores parcourus dans l'ordre : charge reproductible, sans aléatoire.
  const n = exec.scenario.iterationInTest
  const player = data.players[n % PLAYERS]
  const res = http.post(
    `${REST_URL}/scores`,
    JSON.stringify({
      user_id: player,
      game_slug: 'clicker',
      score: (n * 7) % 301,
    }),
    {
      headers: {
        Authorization: `Bearer ${data.serviceRole}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      tags: { name: 'POST /scores' },
    },
  )
  check(res, { 'score : 201': (r) => r.status === 201 })
}

export function readSession() {
  const res = http.get(`${BACKEND_URL}/api/auth/session`, {
    tags: { name: 'GET /api/auth/session' },
  })
  check(res, { 'session : 200': (r) => r.status === 200 })
}

export function handleSummary(data) {
  const metric = (s, p) => data.metrics[`http_req_duration{scenario:${s}}`]?.values[p]
  const lines = ['leaderboard', 'submit_score', 'session']
    .filter((s) => metric(s, 'p(95)') !== undefined)
    .map((s) => `${s.padEnd(14)} P95 = ${metric(s, 'p(95)').toFixed(1)} ms   P99 = ${metric(s, 'p(99)').toFixed(1)} ms`)
  const text = [
    `Profil   : ${PROFILE}`,
    `Requêtes : ${data.metrics.http_reqs.values.count} (${data.metrics.http_reqs.values.rate.toFixed(1)}/s)`,
    `Erreurs  : ${(data.metrics.http_req_failed.values.rate * 100).toFixed(2)} %`,
    ...lines,
  ].join('\n')
  return {
    stdout: `\n${text}\n`,
    [`/quality/reports/k6-${PROFILE === 'load' ? 'summary' : PROFILE}.json`]: JSON.stringify(data, null, 2),
  }
}
