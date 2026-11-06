// Charge de la fin de partie du Yams. Environnement local uniquement :
//   docker compose -f quality/docker-compose.yml run --rm k6 run --quiet /quality/k6/yams.js
import { check, sleep } from 'k6'
import crypto from 'k6/crypto'
import encoding from 'k6/encoding'
import exec from 'k6/execution'
import http from 'k6/http'

const REST_URL = __ENV.REST_URL || 'http://localhost:54330'
const JWT_SECRET = __ENV.JWT_SECRET || 'tiki-quality-local-jwt-secret-0123456789'
const PLAYERS = 1000
const MAX_SCORE = 375

export const options = {
  vus: 50,
  duration: __ENV.DURATION || '1m',
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
  thresholds: {
    http_req_duration: ['p(95)<300'],
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.99'],
  },
}

function playerId(i) {
  const h = crypto.md5(`k6-player-${i}`, 'hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

function jwt(claims) {
  const b64 = (obj) => encoding.b64encode(JSON.stringify(obj), 'rawurl')
  const body = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ ...claims, exp: 4102444800 })}`
  return `${body}.${crypto.hmac('sha256', JWT_SECRET, body, 'base64rawurl')}`
}

export function setup() {
  return { serviceRole: jwt({ role: 'service_role' }) }
}

export default function (data) {
  const n = exec.scenario.iterationInTest
  const player = playerId((n % PLAYERS) + 1)

  // Fin de partie (session.ts › finishGame) : effacer la sauvegarde, puis enregistrer le score.
  const cleared = http.del(`${REST_URL}/game_saves?user_id=eq.${player}&game_slug=eq.yams`, null, {
    headers: { Authorization: `Bearer ${jwt({ sub: player, role: 'authenticated' })}` },
    tags: { name: 'DELETE /game_saves (yams)' },
  })
  check(cleared, { 'sauvegarde effacée : 204': (r) => r.status === 204 })

  const saved = http.post(
    `${REST_URL}/scores`,
    JSON.stringify({ user_id: player, game_slug: 'yams', score: (n * 7) % (MAX_SCORE + 1) }),
    {
      headers: {
        Authorization: `Bearer ${data.serviceRole}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      tags: { name: 'POST /scores (yams)' },
    },
  )
  check(saved, { 'score enregistré : 201': (r) => r.status === 201 })

  sleep(1)
}

export function handleSummary(data) {
  const d = data.metrics.http_req_duration.values
  const text = [
    `Requêtes : ${data.metrics.http_reqs.values.count} (${data.metrics.http_reqs.values.rate.toFixed(1)}/s)`,
    `Erreurs  : ${(data.metrics.http_req_failed.values.rate * 100).toFixed(2)} %`,
    `Latence  : P95 = ${d['p(95)'].toFixed(1)} ms   P99 = ${d['p(99)'].toFixed(1)} ms`,
  ].join('\n')
  return { stdout: `\n${text}\n`, '/quality/reports/k6-yams.json': JSON.stringify(data, null, 2) }
}
