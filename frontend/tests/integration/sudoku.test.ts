import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import pg from 'pg'
import { beforeEach, expect, inject, test } from 'vitest'
import { MIGRATIONS_DIR, applyMigrations } from '../../scripts/migrations.mjs'
import { as, asServer, createUser, describeDb, useDatabase } from './db'

// Le Sudoku sur une vraie base : le conteneur PostgreSQL et le rejeu des migrations viennent de globalSetup.ts.
// Le plafond (6864) est celui de ScoreCalculator en difficile, aligné avec scoreLimits (games.max_score).
const MAX_SCORE = 6864

/** Insère un jeu : depuis la migration des thèmes, `games.theme` est obligatoire et sans valeur par défaut. */
async function insertGameSql(db: pg.Client, slug: string, title: string): Promise<string> {
  const { rowCount } = await db.query(
    `select 1 from information_schema.columns where table_schema = 'public' and table_name = 'games' and column_name = 'theme'`,
  )
  return rowCount
    ? `insert into public.games (slug, title, category, theme) values ('${slug}', '${title}', 'solo', 'reflexion')`
    : `insert into public.games (slug, title, category) values ('${slug}', '${title}', 'solo')`
}

describeDb('sudoku : migrations rejouées', () => {
  const db = useDatabase()

  test('le jeu est au catalogue après le rejeu, avec son plafond de score', async () => {
    const { rows } = await db.query('select title, category, is_active, max_score from public.games where slug = $1', [
      'sudoku',
    ])

    expect(rows).toHaveLength(1)
    expect({ ...rows[0], max_score: Number(rows[0].max_score) }).toEqual({
      title: 'Sudoku',
      category: 'solo',
      is_active: true,
      max_score: MAX_SCORE,
    })
  })

  test('rejouer toutes les migrations ne change rien : aucune n’est appliquée deux fois', async () => {
    const replay = new pg.Client({ connectionString: inject('databaseUrl') })
    await replay.connect()
    try {
      const applied = await applyMigrations(replay)

      expect(applied).toBe(0)
    } finally {
      await replay.end()
    }
  })

  test('les migrations du Sudoku sont suivies dans schema_migrations', async () => {
    const { rows } = await db.query(
      `select name from supabase_migrations.schema_migrations where name like '%sudoku%' order by version`,
    )

    expect(rows.map((r) => r.name)).toEqual(['add_game_sudoku', 'sudoku_max_score'])
  })
})

describeDb('sudoku : unicité', () => {
  const db = useDatabase()
  let alice: string

  beforeEach(async () => {
    alice = await createUser(db, 'alice')
  })

  test('le slug du jeu est unique : un second « sudoku » est refusé', async () => {
    await expect(db.query(await insertGameSql(db, 'sudoku', 'Doublon'))).rejects.toMatchObject({
      code: '23505',
      constraint: 'games_pkey',
    })
  })

  test('rejouer le fichier SQL d’ajout du jeu échoue au lieu de dupliquer le catalogue', async () => {
    const sql = readFileSync(join(MIGRATIONS_DIR, '20261102145517_add_game_sudoku.sql'), 'utf8')
    // Le fichier d'origine date d'avant la colonne theme : on la remplit par défaut (annulé au rollback du test)
    // pour que l'échec vienne bien de l'unicité et non d'un NOT NULL.
    const { rowCount } = await db.query(
      `select 1 from information_schema.columns where table_schema = 'public' and table_name = 'games' and column_name = 'theme'`,
    )
    if (rowCount) {
      await db.query(`alter table public.games alter column theme set default 'reflexion'`)
    }

    await expect(db.query(sql)).rejects.toMatchObject({ code: '23505' })
  })

  test('une sauvegarde par joueur et par jeu : une seconde insertion est refusée', async () => {
    const save = (gameId: string) =>
      db.query(`insert into public.game_saves (user_id, game_slug, data) values ($1, 'sudoku', $2)`, [
        alice,
        { gameId },
      ])
    await save('g1')

    await expect(as(db, alice, () => save('g2'))).rejects.toMatchObject({ code: '23505' })
  })

  test('l’écriture avec on conflict remplace la sauvegarde : l’id de la dernière partie reste seul', async () => {
    const upsert = (gameId: string) =>
      as(db, alice, () =>
        db.query(
          `insert into public.game_saves (user_id, game_slug, data) values ($1, 'sudoku', $2)
           on conflict (user_id, game_slug) do update set data = excluded.data`,
          [alice, { gameId }],
        ),
      )

    await upsert('g1')
    await upsert('g2')

    const { rows } = await db.query(`select data from public.game_saves where user_id = $1 and game_slug = 'sudoku'`, [
      alice,
    ])
    expect(rows).toEqual([{ data: { gameId: 'g2' } }])
  })

  test('deux écritures simultanées de la même sauvegarde : une passe, l’autre est refusée sans doublon', async () => {
    // Deux vraies connexions et deux transactions ouvertes : la seconde attend la première, puis échoue.
    // Hors de la transaction annulée des autres tests, donc le compte créé est supprimé à la fin.
    const a = new pg.Client({ connectionString: inject('databaseUrl') })
    const b = new pg.Client({ connectionString: inject('databaseUrl') })
    await Promise.all([a.connect(), b.connect()])
    let racer = ''
    try {
      racer = await createUser(a, 'racer')
      const save = (client: pg.Client, gameId: string) =>
        client.query(`insert into public.game_saves (user_id, game_slug, data) values ($1, 'sudoku', $2)`, [
          racer,
          { gameId },
        ])
      await Promise.all([a.query('begin'), b.query('begin')])
      await save(a, 'a')
      const blocked = save(b, 'b')
      const outcome = expect(blocked).rejects.toMatchObject({ code: '23505' })

      await a.query('commit')
      await outcome
      await b.query('rollback')

      const { rows } = await a.query(`select data from public.game_saves where user_id = $1`, [racer])
      expect(rows).toEqual([{ data: { gameId: 'a' } }])
    } finally {
      if (racer) await a.query('delete from auth.users where id = $1', [racer])
      await Promise.all([a.end(), b.end()])
    }
  })
})

describeDb('sudoku : scores et atomicité', () => {
  const db = useDatabase()
  let alice: string

  // Seul le backend écrit les scores (POST /api/scores), pour le compte du joueur de la session.
  const insertScore = (score: number) =>
    db.query(`insert into public.scores (user_id, game_slug, score) values ($1, 'sudoku', $2)`, [alice, score])
  const scoresOfAlice = async () =>
    (await db.query('select score from public.scores where user_id = $1 order by id', [alice])).rows.map((r) =>
      Number(r.score),
    )
  const savesOfAlice = async () =>
    (await db.query(`select data from public.game_saves where user_id = $1 and game_slug = 'sudoku'`, [alice])).rows

  beforeEach(async () => {
    alice = await createUser(db, 'alice')
  })

  // Valeurs limites autour du plafond : 0 accepté, 6864 accepté, 6865 refusé, -1 refusé
  test.each([0, 1, MAX_SCORE])('accepte le score %d', async (score) => {
    await asServer(db, () => insertScore(score))

    expect(await scoresOfAlice()).toEqual([score])
  })

  test('refuse un score au-dessus du plafond, sans rien écrire', async () => {
    await expect(asServer(db, () => insertScore(MAX_SCORE + 1))).rejects.toMatchObject({ code: '23514' })

    expect(await scoresOfAlice()).toEqual([])
  })

  test('refuse un score négatif', async () => {
    await expect(asServer(db, () => insertScore(-1))).rejects.toMatchObject({ code: '23514' })
  })

  test('fin de partie atomique : si le score est refusé, la sauvegarde effacée dans la même étape revient', async () => {
    await db.query(`insert into public.game_saves (user_id, game_slug, data) values ($1, 'sudoku', $2)`, [
      alice,
      { gameId: 'g1' },
    ])

    // Effacer la sauvegarde puis envoyer le score, en une seule étape : l'échec annule aussi l'effacement.
    await expect(
      asServer(db, async () => {
        await db.query(`delete from public.game_saves where user_id = $1 and game_slug = 'sudoku'`, [alice])
        await insertScore(MAX_SCORE + 1)
      }),
    ).rejects.toMatchObject({ code: '23514' })

    expect(await savesOfAlice()).toEqual([{ data: { gameId: 'g1' } }])
    expect(await scoresOfAlice()).toEqual([])
  })

  test('fin de partie atomique : si tout passe, la sauvegarde est effacée et le score enregistré', async () => {
    await db.query(`insert into public.game_saves (user_id, game_slug, data) values ($1, 'sudoku', $2)`, [
      alice,
      { gameId: 'g1' },
    ])

    await asServer(db, async () => {
      await db.query(`delete from public.game_saves where user_id = $1 and game_slug = 'sudoku'`, [alice])
      await insertScore(2354)
    })

    expect(await savesOfAlice()).toEqual([])
    expect(await scoresOfAlice()).toEqual([2354])
  })

  test('le classement du Sudoku garde le meilleur score du joueur et compte ses parties', async () => {
    await asServer(db, () => insertScore(1166))
    await asServer(db, () => insertScore(2354))

    const { rows } = await as(db, null, () =>
      db.query(`select username, best_score, games_played from public.leaderboard where game_slug = 'sudoku'`),
    )

    expect(rows.map((r) => [r.username, Number(r.best_score), Number(r.games_played)])).toEqual([['alice', 2354, 2]])
  })
})

describeDb('sudoku : atomicité d’une migration', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sudoku-migrations-'))
  const replay = new pg.Client({ connectionString: inject('databaseUrl') })

  test('une migration qui échoue en cours de route n’écrit rien : ni ligne, ni trace dans schema_migrations', async () => {
    // Première instruction valide (ajout d'un jeu), seconde en conflit d'unicité (le slug « sudoku » existe déjà).
    await replay.connect()
    try {
      writeFileSync(
        join(dir, '29991231235959_sudoku_atomicite.sql'),
        `${await insertGameSql(replay, 'sudoku-essai', 'Essai')};\n${await insertGameSql(replay, 'sudoku', 'Doublon')};`,
      )
      await expect(applyMigrations(replay, { dir })).rejects.toMatchObject({
        message: expect.stringContaining('29991231235959_sudoku_atomicite.sql'),
        cause: expect.objectContaining({ code: '23505' }),
      })

      const games = await replay.query(`select 1 from public.games where slug = 'sudoku-essai'`)
      const traces = await replay.query(
        `select 1 from supabase_migrations.schema_migrations where version = '29991231235959'`,
      )
      expect([games.rowCount, traces.rowCount]).toEqual([0, 0])
    } finally {
      await replay.end()
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
