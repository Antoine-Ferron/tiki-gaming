#!/usr/bin/env node
// Vérifie supabase/migrations sans base de données (CI, job Integration) : format des noms, versions uniques.
//   npm run db:check
import { readdirSync } from 'node:fs'
import { MIGRATIONS_DIR, parseMigrations } from './migrations.mjs'

try {
  const migrations = parseMigrations(readdirSync(MIGRATIONS_DIR))
  console.log(`${migrations.length} migration(s), versions uniques.`)
} catch (e) {
  console.error(e.message)
  process.exitCode = 1
}
