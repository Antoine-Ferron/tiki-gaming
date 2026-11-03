// Runner de migrations partagé : `npm run db:migrate` (scripts/db.mjs) et tests d'intégration (Testcontainers).
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const MIGRATIONS_DIR = fileURLToPath(new URL('../../supabase/migrations', import.meta.url))

/**
 * Applique, dans l'ordre et chacune dans sa transaction, les migrations pas encore appliquées.
 * @param {import('pg').Client} client
 * @param {{ dir?: string, log?: (message: string) => void }} [options]
 * @returns {Promise<number>} nombre de migrations appliquées
 */
export async function applyMigrations(client, { dir = MIGRATIONS_DIR, log = () => {} } = {}) {
  // Même table de suivi que la CLI Supabase, pour rester compatible avec `supabase db push`.
  await client.query(`
    create schema if not exists supabase_migrations;
    create table if not exists supabase_migrations.schema_migrations (
      version text primary key, statements text[], name text
    );`)
  const { rows } = await client.query('select version from supabase_migrations.schema_migrations')
  const applied = new Set(rows.map((r) => r.version))
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
  let count = 0
  for (const file of files) {
    const [version, ...rest] = file.replace(/\.sql$/, '').split('_')
    if (applied.has(version)) continue
    const sql = readFileSync(join(dir, file), 'utf8')
    log(`→ ${file}`)
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
      throw new Error(`Migration ${file} : ${e.message}`, { cause: e })
    }
  }
  // Recharge le cache de schéma de l'API REST (PostgREST).
  await client.query(`notify pgrst, 'reload schema'`)
  return count
}
