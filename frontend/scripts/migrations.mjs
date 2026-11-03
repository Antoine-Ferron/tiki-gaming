// Runner de migrations partagé : `npm run db:migrate` (scripts/db.mjs) et tests d'intégration (Testcontainers).
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const MIGRATIONS_DIR = fileURLToPath(new URL('../../supabase/migrations', import.meta.url))

/** `<version>_<nom>.sql`, version = horodatage AAAAMMJJHHMMSS, comme le crée `supabase migration new <nom>`. */
const FILE_PATTERN = /^(\d{14})_([a-z0-9_]+)\.sql$/

/**
 * Migrations du dossier, dans l'ordre d'application. Une migration est identifiée par sa seule version : deux
 * fichiers de même version, et le second serait considéré comme déjà appliqué, donc ignoré sans bruit. Refusé.
 * @param {string[]} fileNames noms des fichiers du dossier (les fichiers autres que .sql sont ignorés)
 * @returns {{ file: string, version: string, name: string }[]}
 * @throws {Error} si un nom ne suit pas le format ou si une version est en double
 */
export function parseMigrations(fileNames) {
  const errors = []
  const byVersion = new Map()
  const migrations = []
  const files = fileNames.filter((f) => f.endsWith('.sql')).sort((a, b) => a.localeCompare(b, 'en'))
  for (const file of files) {
    const match = FILE_PATTERN.exec(file)
    if (!match) {
      errors.push(`${file} : nom attendu AAAAMMJJHHMMSS_nom.sql (supabase migration new <nom>)`)
      continue
    }
    const [, version, name] = match
    const other = byVersion.get(version)
    if (other) errors.push(`${file} : même version que ${other}, l'une des deux ne serait jamais appliquée`)
    else byVersion.set(version, file)
    migrations.push({ file, version, name })
  }
  if (errors.length) throw new Error(`Migrations invalides :\n- ${errors.join('\n- ')}`)
  return migrations
}

/**
 * Applique, dans l'ordre et chacune dans sa transaction, les migrations pas encore appliquées.
 * @param {import('pg').Client} client
 * @param {{ dir?: string, log?: (message: string) => void }} [options]
 * @returns {Promise<number>} nombre de migrations appliquées
 * @throws {Error} si le dossier est invalide (voir parseMigrations) ou si une version est déjà appliquée en base
 *   sous un autre nom : ce fichier-là ne serait jamais appliqué
 */
export async function applyMigrations(client, { dir = MIGRATIONS_DIR, log = () => {} } = {}) {
  const migrations = parseMigrations(readdirSync(dir))
  // Même table de suivi que la CLI Supabase, pour rester compatible avec `supabase db push`.
  await client.query(`
    create schema if not exists supabase_migrations;
    create table if not exists supabase_migrations.schema_migrations (
      version text primary key, statements text[], name text
    );`)
  const { rows } = await client.query('select version, name from supabase_migrations.schema_migrations')
  const applied = new Map(rows.map((r) => [r.version, r.name]))
  // Vérifié avant d'appliquer quoi que ce soit : la base n'est pas laissée à moitié migrée.
  for (const { file, version, name } of migrations) {
    if (applied.has(version) && applied.get(version) !== name) {
      throw new Error(
        `Migration ${file} : la version ${version} est déjà appliquée sous le nom « ${applied.get(version)} ». ` +
          'Ce fichier ne serait jamais appliqué : donne-lui un nouvel horodatage (supabase migration new <nom>).',
      )
    }
  }
  let count = 0
  for (const { file, version, name } of migrations) {
    if (applied.has(version)) continue
    const sql = readFileSync(join(dir, file), 'utf8')
    log(`→ ${file}`)
    await client.query('begin')
    try {
      await client.query(sql)
      await client.query(
        'insert into supabase_migrations.schema_migrations (version, name, statements) values ($1, $2, $3)',
        [version, name, [sql]],
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
