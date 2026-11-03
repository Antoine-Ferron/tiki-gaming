import { beforeEach, expect, test } from 'vitest'
import { as, createUser, describeDb, useDatabase } from './db'

// Boîte grise : on passe par les droits de l'API (rôles + RLS) et on vérifie l'état réel de la base.
describeDb('scores (RLS et contraintes)', () => {
  const db = useDatabase()
  let alice: string
  let bob: string

  const insertScore = (score: number, game = 'clicker', userId?: string) =>
    db.query(
      userId
        ? 'insert into public.scores (game_slug, score, user_id) values ($1, $2, $3)'
        : 'insert into public.scores (game_slug, score) values ($1, $2)',
      userId ? [game, score, userId] : [game, score],
    )
  const scoresOf = async (userId: string) =>
    (await db.query('select score from public.scores where user_id = $1 order by id', [userId])).rows.map((r) =>
      Number(r.score),
    )

  beforeEach(async () => {
    alice = await createUser(db, 'alice')
    bob = await createUser(db, 'bob')
  })

  test('un joueur enregistre son score, rattaché à son compte par auth.uid()', async () => {
    await as(db, alice, () => insertScore(42))

    expect(await scoresOf(alice)).toEqual([42])
  })

  test('un joueur ne peut pas enregistrer un score au nom d’un autre', async () => {
    await expect(as(db, alice, () => insertScore(42, 'clicker', bob))).rejects.toMatchObject({ code: '42501' })
    expect(await scoresOf(bob)).toEqual([])
  })

  test('un visiteur non connecté ne peut pas enregistrer de score', async () => {
    await expect(as(db, null, () => insertScore(1))).rejects.toMatchObject({ code: '42501' })
  })

  test('un jeu inactif refuse les scores', async () => {
    await db.query(`update public.games set is_active = false where slug = 'clicker'`)

    await expect(as(db, alice, () => insertScore(1))).rejects.toMatchObject({ code: '42501' })
  })

  test('un jeu absent du catalogue refuse les scores', async () => {
    await expect(as(db, alice, () => insertScore(1, 'inconnu'))).rejects.toMatchObject({ code: '42501' })
  })

  test('un jeu dont le serveur classe les scores (Prismine) refuse ceux des joueurs et les doublons', async () => {
    await expect(as(db, alice, () => insertScore(150, 'prismine'))).rejects.toMatchObject({ code: '42501' })
    expect(await scoresOf(alice)).toEqual([])

    // Le backend (hors RLS) classe une fois par expédition : une nouvelle tentative est refusée en doublon.
    const insertRun = () =>
      db.query(
        `insert into public.scores (game_slug, score, user_id, metadata) values ('prismine', 150, $1, '{"runId": "r1"}')`,
        [alice],
      )
    await insertRun()
    // Savepoint : le doublon refusé ne doit pas avorter la transaction du test.
    await db.query('savepoint duplicate_run')
    await expect(insertRun()).rejects.toMatchObject({ code: '23505' })
    await db.query('rollback to savepoint duplicate_run')
    expect(await scoresOf(alice)).toEqual([150])
  })

  // Valeurs limites basses : -1 refusé, 0 accepté
  test('refuse un score négatif', async () => {
    await expect(as(db, alice, () => insertScore(-1))).rejects.toMatchObject({ code: '23514' })
  })

  test('accepte un score nul', async () => {
    await as(db, alice, () => insertScore(0))

    expect(await scoresOf(alice)).toEqual([0])
  })

  // Valeurs limites hautes autour de games.max_score (300 pour le Clicker) : 299, 300, 301
  test.each([299, 300])('accepte %d (≤ max_score)', async (score) => {
    await as(db, alice, () => insertScore(score))

    expect(await scoresOf(alice)).toEqual([score])
  })

  test('refuse 301 (> max_score)', async () => {
    await expect(as(db, alice, () => insertScore(301))).rejects.toMatchObject({ code: '42501' })
  })

  test('sans max_score, un grand score est accepté', async () => {
    await db.query(`update public.games set max_score = null where slug = 'clicker'`)

    await as(db, alice, () => insertScore(1_000_000))

    expect(await scoresOf(alice)).toEqual([1_000_000])
  })

  test('un score enregistré ne peut être ni modifié ni supprimé par le joueur', async () => {
    await as(db, alice, () => insertScore(10))

    await expect(as(db, alice, () => db.query('update public.scores set score = 300'))).rejects.toMatchObject({
      code: '42501',
    })
    await expect(as(db, alice, () => db.query('delete from public.scores'))).rejects.toMatchObject({ code: '42501' })
    expect(await scoresOf(alice)).toEqual([10])
  })

  test('le classement garde le meilleur score de chaque joueur et compte ses parties, lisible sans compte', async () => {
    await as(db, alice, () => insertScore(10))
    await as(db, alice, () => insertScore(30))
    await as(db, bob, () => insertScore(20))

    const { rows } = await as(db, null, () =>
      db.query(
        `select username, best_score, games_played from public.leaderboard
         where game_slug = 'clicker' order by best_score desc`,
      ),
    )

    expect(rows.map((r) => [r.username, Number(r.best_score), Number(r.games_played)])).toEqual([
      ['alice', 30, 2],
      ['bob', 20, 1],
    ])
  })
})
