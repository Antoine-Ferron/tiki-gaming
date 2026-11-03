import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Client } from 'pg'
import { afterEach, describe, expect, it } from 'vitest'
import { applyMigrations, MIGRATIONS_DIR, parseMigrations } from './migrations.mjs'

describe('parseMigrations', () => {
  it('trie les migrations par version et sépare version et nom', () => {
    expect(parseMigrations(['20261103090000_score_limits.sql', '20261102000000_init_platform.sql'])).toEqual([
      { file: '20261102000000_init_platform.sql', version: '20261102000000', name: 'init_platform' },
      { file: '20261103090000_score_limits.sql', version: '20261103090000', name: 'score_limits' },
    ])
  })

  it('ignore les fichiers qui ne sont pas des .sql', () => {
    expect(parseMigrations(['.gitkeep', 'README.md'])).toEqual([])
  })

  it('refuse deux fichiers de même version, en nommant les deux', () => {
    expect(() =>
      parseMigrations(['20261103100000_prismine_runs.sql', '20261103100000_mastermind_max_score.sql']),
    ).toThrow(
      '20261103100000_prismine_runs.sql : même version que 20261103100000_mastermind_max_score.sql, ' +
        "l'une des deux ne serait jamais appliquée",
    )
  })

  it.each([
    ['version trop courte', '2026110309_score_limits.sql'],
    ['sans nom', '20261103090000.sql'],
    ['nom en majuscules', '20261103090000_Score_Limits.sql'],
    ['tiret au lieu de _', '20261103090000-score_limits.sql'],
  ])('refuse un nom hors format (%s)', (_, file) => {
    expect(() => parseMigrations([file])).toThrow(`${file} : nom attendu AAAAMMJJHHMMSS_nom.sql`)
  })

  it('liste toutes les erreurs du dossier en une fois', () => {
    expect(() => parseMigrations(['bad.sql', '20261103100000_a.sql', '20261103100000_b.sql', 'ALSO_BAD.sql'])).toThrow(
      [
        'Migrations invalides :',
        "- 20261103100000_b.sql : même version que 20261103100000_a.sql, l'une des deux ne serait jamais appliquée",
        '- ALSO_BAD.sql : nom attendu AAAAMMJJHHMMSS_nom.sql (supabase migration new <nom>)',
        '- bad.sql : nom attendu AAAAMMJJHHMMSS_nom.sql (supabase migration new <nom>)',
      ].join('\n'),
    )
  })

  it('accepte les migrations du dépôt', () => {
    expect(parseMigrations(readdirSync(MIGRATIONS_DIR)).length).toBeGreaterThan(0)
  })
})

/** Faux client pg : `applied` simule schema_migrations, `queries` garde le SQL exécuté. */
function fakeClient(applied: { version: string; name: string }[]) {
  const queries: string[] = []
  const client = {
    query: async (sql: string) => {
      queries.push(sql.trim())
      return { rows: sql.includes('select version, name') ? applied : [] }
    },
  }
  return { client: client as unknown as Client, queries }
}

describe('applyMigrations', () => {
  let dir: string

  function migrationsDir(files: Record<string, string>) {
    dir = mkdtempSync(join(tmpdir(), 'migrations-'))
    for (const [file, sql] of Object.entries(files)) writeFileSync(join(dir, file), sql)
    return dir
  }

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true })
  })

  it('applique seulement les versions absentes de la base, même plus anciennes que la dernière appliquée', async () => {
    const { client, queries } = fakeClient([{ version: '20261103090000', name: 'score_limits' }])
    const count = await applyMigrations(client, {
      dir: migrationsDir({
        '20261102161939_add_game_yams.sql': 'select 1',
        '20261103090000_score_limits.sql': 'select 2',
      }),
    })

    expect(count).toBe(1)
    expect(queries).toContain('select 1')
    expect(queries).not.toContain('select 2')
  })

  it('refuse un fichier dont la version est déjà appliquée sous un autre nom, sans rien appliquer', async () => {
    const { client, queries } = fakeClient([{ version: '20261103100000', name: 'mastermind_max_score' }])

    await expect(
      applyMigrations(client, {
        dir: migrationsDir({
          '20261102161939_add_game_yams.sql': 'select 1',
          '20261103100000_prismine_runs.sql': 'select 2',
        }),
      }),
    ).rejects.toThrow('la version 20261103100000 est déjà appliquée sous le nom « mastermind_max_score »')
    expect(queries).not.toContain('select 2')
  })

  it('refuse un dossier invalide avant de toucher à la base', async () => {
    const { client, queries } = fakeClient([])

    await expect(
      applyMigrations(client, {
        dir: migrationsDir({ '20261103100000_a.sql': 'select 1', '20261103100000_b.sql': 'select 2' }),
      }),
    ).rejects.toThrow('Migrations invalides')
    expect(queries).toEqual([])
  })
})
