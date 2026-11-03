// Test de charge du lobby (k6). Cible l'environnement local de quality/docker-compose.yml, jamais la production.
//   docker run --rm --network host -v "$PWD/quality:/quality" grafana/k6:2.3.0 run /quality/k6/lobby.js
// Variables : REST_URL (PostgREST), BACKEND_URL (backend Java, scénario ignoré si vide), DURATION, JWT_SECRET.
import { check } from 'k6'
import crypto from 'k6/crypto'
import encoding from 'k6/encoding'
import http from 'k6/http'

const REST_URL = __ENV.REST_URL || 'http://localhost:54330'
const BACKEND_URL = __ENV.BACKEND_URL || ''
const DURATION = __ENV.DURATION || '30s'
// Secret de l'environnement local (quality/docker-compose.yml), pas celui de la production.
const JWT_SECRET = __ENV.JWT_SECRET || 'tiki-quality-local-jwt-secret-0123456789'
const PLAYERS = 1000 // = PLAYERS de frontend/scripts/seed-quality.mjs

const scenario = (exec, rate) => ({
  executor: 'constant-arrival-rate',
  exec,
  rate,
  timeUnit: '1s',
  duration: DURATION,
  preAllocatedVUs: 20,
  maxVUs: 100,
})

export const options = {
  scenarios: {
    // Chaque ouverture d'une page de jeu lit le classement (visiteur ou joueur).
    leaderboard: scenario('readLeaderboard', 100),
    // Fin de partie d'un joueur connecté : insertion contrôlée par la RLS (auth.uid(), max_score).
    submit_score: scenario('submitScore', 20),
    ...(BACKEND_URL ? { session: scenario('readSession', 50) } : {}),
  },
  thresholds: {
    'http_req_duration{scenario:leaderboard}': ['p(95)<300'],
    'http_req_duration{scenario:submit_score}': ['p(95)<300'],
    ...(BACKEND_URL ? { 'http_req_duration{scenario:session}': ['p(95)<300'] } : {}),
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.99'],
  },
}

/** md5 → uuid, comme md5('k6-player-' || i)::uuid dans le jeu de données. */
function playerId(i) {
  const h = crypto.md5(`k6-player-${i}`, 'hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

/** JWT HS256 au format Supabase (rôle authenticated, sub = joueur). */
function jwtFor(sub) {
  const b64 = (obj) => encoding.b64encode(JSON.stringify(obj), 'rawurl')
  const body = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub, role: 'authenticated', exp: 4102444800 })}`
  return `${body}.${crypto.hmac('sha256', JWT_SECRET, body, 'base64rawurl')}`
}

export function setup() {
  return { tokens: Array.from({ length: PLAYERS }, (_, i) => jwtFor(playerId(i + 1))) }
}

export function readLeaderboard() {
  const res = http.get(`${REST_URL}/leaderboard?game_slug=eq.clicker&order=best_score.desc,username.asc&limit=10`, {
    tags: { name: 'GET /leaderboard' },
  })
  check(res, { 'classement : 200 et 10 lignes': (r) => r.status === 200 && r.json().length === 10 })
}

export function submitScore(data) {
  const token = data.tokens[Math.floor(Math.random() * PLAYERS)]
  const res = http.post(
    `${REST_URL}/scores`,
    JSON.stringify({ game_slug: 'clicker', score: Math.floor(Math.random() * 301) }),
    {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      tags: { name: 'POST /scores' },
    },
  )
  check(res, { 'score : 201': (r) => r.status === 201 })
}

export function readSession() {
  const res = http.get(`${BACKEND_URL}/api/auth/session`, { tags: { name: 'GET /api/auth/session' } })
  check(res, { 'session : 200': (r) => r.status === 200 })
}

export function handleSummary(data) {
  const p95 = (s) => data.metrics[`http_req_duration{scenario:${s}}`]?.values['p(95)']
  const lines = ['leaderboard', 'submit_score', 'session']
    .filter((s) => p95(s) !== undefined)
    .map((s) => `${s.padEnd(14)} P95 = ${p95(s).toFixed(1)} ms`)
  const text = [
    `Requêtes : ${data.metrics.http_reqs.values.count} (${data.metrics.http_reqs.values.rate.toFixed(1)}/s)`,
    `Erreurs  : ${(data.metrics.http_req_failed.values.rate * 100).toFixed(2)} %`,
    ...lines,
  ].join('\n')
  return { stdout: `\n${text}\n`, '/quality/reports/k6-summary.json': JSON.stringify(data, null, 2) }
}
