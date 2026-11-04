import { beforeEach, expect, test } from 'vitest'
import { as, createUser, describeDb, useDatabase } from './db'

const MAX_SCORE = 375

describeDb('yams : migrations rejouées', () => {
  const db = useDatabase()

  test('la migration du Yams est appliquée : le jeu est au catalogue avec son plafond de score', async () => {
    const migrations = await db.query(`select name from supabase_migrations.schema_migrations where name like '%yams%'`)
    const games = await db.query('select max_score from public.games where slug = $1', ['yams'])

    expect(migrations.rows.map((r) => r.name)).toEqual(['add_game_yams'])
    expect(Number(games.rows[0].max_score)).toBe(MAX_SCORE)
  })
})

describeDb('yams : conflits d’unicité', () => {
  const db = useDatabase()
  let alice: string

  beforeEach(async () => {
    alice = await createUser(db, 'alice')
  })

  test('le jeu est unique au catalogue : un second « yams » est refusé', async () => {
    const insertGame = db.query(
      `insert into public.games (slug, title, category, theme) values ('yams', 'Doublon', 'solo', 'strategie')`,
    )

    await expect(insertGame).rejects.toMatchObject({ code: '23505', constraint: 'games_pkey' })
  })

  test('une seule sauvegarde du Yams par joueur : une seconde insertion est refusée', async () => {
    const save = () =>
      db.query(`insert into public.game_saves (user_id, game_slug, data) values ($1, 'yams', '{}')`, [alice])
    await save()

    await expect(as(db, alice, save)).rejects.toMatchObject({ code: '23505' })
  })
})

describeDb('yams : atomicité de la fin de partie', () => {
  const db = useDatabase()
  let alice: string

  // Comme finishGame (session.ts) : effacer la sauvegarde puis envoyer le score du joueur 1.
  const finishGame = (score: number) =>
    as(db, alice, async () => {
      await db.query(`delete from public.game_saves where user_id = $1 and game_slug = 'yams'`, [alice])
      await db.query(`insert into public.scores (game_slug, score) values ('yams', $1)`, [score])
    })
  const savesOfAlice = async () =>
    (await db.query(`select 1 from public.game_saves where user_id = $1 and game_slug = 'yams'`, [alice])).rowCount
  const scoresOfAlice = async () =>
    (await db.query(`select score from public.scores where user_id = $1`, [alice])).rows.map((r) => Number(r.score))

  beforeEach(async () => {
    alice = await createUser(db, 'alice')
    await db.query(`insert into public.game_saves (user_id, game_slug, data) values ($1, 'yams', '{}')`, [alice])
  })

  test('score refusé (376, au-dessus du plafond) : rien n’est écrit, la sauvegarde effacée revient', async () => {
    await expect(finishGame(MAX_SCORE + 1)).rejects.toMatchObject({ code: '42501' })

    expect(await savesOfAlice()).toBe(1)
    expect(await scoresOfAlice()).toEqual([])
  })

  test('score accepté (375, le plafond) : la sauvegarde est effacée et le score enregistré', async () => {
    await finishGame(MAX_SCORE)

    expect(await savesOfAlice()).toBe(0)
    expect(await scoresOfAlice()).toEqual([MAX_SCORE])
  })
})
