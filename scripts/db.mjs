#!/usr/bin/env node
// Outil local d'administration de la base (connexion Postgres directe, contourne la RLS).
//   npm run db:sql -- "select * from public.games"
//   npm run db:sql -- -f chemin/fichier.sql
//   npm run db:migrate            # applique les migrations de supabase/migrations non encore appliquées
// Lit SUPABASE_PROJECT_REF / SUPABASE_DB_PASSWORD (+ SUPABASE_DB_HOST optionnel) depuis .env.
import 'dotenv/config'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import pg from 'pg'

const ref = process.env.SUPABASE_PROJECT_REF
const password = process.env.SUPABASE_DB_PASSWORD
if (!ref || !password) {
  console.error('SUPABASE_PROJECT_REF et SUPABASE_DB_PASSWORD doivent être définis dans .env')
  process.exit(1)
}

// Pooler Supavisor en mode session (IPv4), région du projet.
const hosts = process.env.SUPABASE_DB_HOST
  ? [process.env.SUPABASE_DB_HOST]
  : ['aws-0-eu-west-1.pooler.supabase.com', 'aws-1-eu-west-1.pooler.supabase.com']

async function connect() {
  let lastError
  for (const host of hosts) {
    const client = new pg.Client({
      host,
      port: 5432,
      user: `postgres.${ref}`,
      password,
      database: 'postgres',
      ssl: { rejectUnauthorized: false },
    })
    try {
      await client.connect()
      return client
    } catch (e) {
      lastError = e
    }
  }
  throw lastError
}

async function migrate(client) {
  // Même table de suivi que la CLI Supabase, pour rester compatible avec `supabase db push`.
  await client.query(`
    create schema if not exists supabase_migrations;
    create table if not exists supabase_migrations.schema_migrations (
      version text primary key, statements text[], name text
    );`)
  const { rows } = await client.query('select version from supabase_migrations.schema_migrations')
  const applied = new Set(rows.map((r) => r.version))
  const dir = 'supabase/migrations'
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()
  let count = 0
  for (const file of files) {
    const [version, ...rest] = file.replace(/\.sql$/, '').split('_')
    if (applied.has(version)) continue
    const sql = readFileSync(join(dir, file), 'utf8')
    console.log(`→ ${file}`)
    await client.query('begin')
    try {
      await client.query(sql)
      await client.query(
        'insert into supabase_migrations.schema_migrations (version, name, statements) values ($1, $2, $3)',
        [version, rest.join('_'), [sql]],
      )
      await client.query('commit')
      count++
    } catch (e) {
      await client.query('rollback')
      throw e
    }
  }
  // Recharge le cache de schéma de l'API REST (PostgREST).
  await client.query(`notify pgrst, 'reload schema'`)
  console.log(count ? `${count} migration(s) appliquée(s).` : 'Base à jour.')
}

const args = process.argv.slice(2)
const client = await connect()
try {
  if (args[0] === '--migrate') {
    await migrate(client)
  } else {
    const sql = args[0] === '-f' ? readFileSync(args[1], 'utf8') : args.join(' ')
    if (!sql.trim()) throw new Error('Aucune requête fournie')
    const res = await client.query(sql)
    for (const r of [res].flat()) {
      if (r.rows?.length) console.table(r.rows)
      else console.log(`${r.command ?? 'OK'} ${r.rowCount ?? ''}`.trim())
    }
  }
} catch (e) {
  console.error(e.message)
  process.exitCode = 1
} finally {
  await client.end()
}
