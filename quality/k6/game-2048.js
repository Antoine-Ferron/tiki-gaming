// Test de charge du 2048 (k6). Le jeu tourne dans le navigateur : son seul appel serveur à l'ouverture
// est la lecture du classement. Environnement local de quality/docker-compose.yml, jamais la production.
//   docker compose -f quality/docker-compose.yml run --rm k6 run /quality/k6/game-2048.js
// Seuils = SLO de docs/slo.md : P95 < 300 ms, P99 < 500 ms, moins de 1 % d'erreurs.
import { check } from 'k6'
import crypto from 'k6/crypto'
import encoding from 'k6/encoding'
import http from 'k6/http'

const REST_URL = __ENV.REST_URL || 'http://localhost:54330'
const JWT_SECRET = __ENV.JWT_SECRET || 'tiki-quality-local-jwt-secret-0123456789'
const PLAYERS = 100

export const options = {
  summaryTrendStats: ['avg', 'med', 'max', 'p(95)', 'p(99)'],
  scenarios: {
    open_game: {
      executor: 'constant-arrival-rate',
      rate: 50,
      timeUnit: '1s',
      duration: __ENV.DURATION || '30s',
      preAllocatedVUs: 20,
      maxVUs: 200,
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<300', 'p(99)<500'],
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.99'],
  },
}

function jwt(claims) {
  const b64 = (obj) => encoding.b64encode(JSON.stringify(obj), 'rawurl')
  const body = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ ...claims, exp: 4102444800 })}`
  return `${body}.${crypto.hmac('sha256', JWT_SECRET, body, 'base64rawurl')}`
}

function playerId(i) {
  const h = crypto.md5(`k6-player-${i}`, 'hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

/** Remplit le classement du 2048 avec les joueurs factices du jeu de données (npm run quality:seed). */
export function setup() {
  const rows = Array.from({ length: PLAYERS }, (_, i) => ({
    user_id: playerId(i + 1),
    game_slug: 'game-2048',
    score: (i * 97) % 5000,
  }))
  const res = http.post(`${REST_URL}/scores`, JSON.stringify(rows), {
    headers: {
      Authorization: `Bearer ${jwt({ role: 'service_role' })}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
  })
  if (res.status !== 201) throw new Error(`Jeu de données du 2048 refusé : ${res.status} ${res.body}`)
}

export default function () {
  const res = http.get(`${REST_URL}/leaderboard?game_slug=eq.game-2048&order=best_score.desc,username.asc&limit=10`, {
    tags: { name: 'GET /leaderboard (2048)' },
  })
  check(res, { 'classement 2048 : 200 et 10 lignes': (r) => r.status === 200 && r.json().length === 10 })
}
