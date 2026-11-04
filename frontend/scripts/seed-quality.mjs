#!/usr/bin/env node
// Prépare la base de qualimétrie (quality/docker-compose.yml, service db) : migrations du dépôt puis données
// factices et déterministes pour les tests de charge k6. Ne vise jamais la base de production.
//   npm run quality:seed            (QUALITY_DB_URL pour une autre base locale)
import pg from 'pg'
import { applyMigrations } from './migrations.mjs'

const url = process.env.QUALITY_DB_URL ?? 'postgres://postgres:postgres@localhost:54329/postgres'
if (/supabase\.(co|com)/.test(url)) throw new Error('seed-quality refuse de tourner sur une base Supabase hébergée')

export const PLAYERS = 1000
const GAMES_PER_PLAYER = 10

const client = new pg.Client({ connectionString: url })
await client.connect()
try {
  const count = await applyMigrations(client)
  console.log(`${count} migration(s) appliquée(s).`)
  // Identifiants déterministes (md5 du numéro) : k6 recalcule les mêmes pour choisir les joueurs.
  await client.query(
    `insert into auth.users (id, email, raw_user_meta_data)
     select md5('k6-player-' || i)::uuid, 'k6-' || i || '@quality.local', jsonb_build_object('username', 'k6_' || i)
     from generate_series(1, $1) i
     on conflict (id) do nothing`,
    [PLAYERS],
  )
  await client.query('truncate public.scores')
  await client.query(
    `insert into public.scores (user_id, game_slug, score)
     select md5('k6-player-' || i)::uuid, 'clicker', (i * 7 + g * 13) % 301
     from generate_series(1, $1) i, generate_series(1, $2) g`,
    [PLAYERS, GAMES_PER_PLAYER],
  )
  await client.query('analyze public.scores')
  await client.query(`notify pgrst, 'reload schema'`)
  console.log(`${PLAYERS} joueurs, ${PLAYERS * GAMES_PER_PLAYER} scores.`)
} finally {
  await client.end()
}
