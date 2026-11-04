import { beforeEach, expect, test } from 'vitest'
import { as, asServer, createUser, describeDb, useDatabase } from './db'

// Boîte grise : on passe par les droits de l'API (rôles + RLS) et on vérifie l'état réel de la base.
// Seul le backend (service_role, POST /api/scores) écrit les scores ; les règles du catalogue sont dans un trigger.
describeDb('scores (droits, trigger et contraintes)', () => {
  const db = useDatabase()
  let alice: string
  let bob: string

  /** Insertion faite par le backend pour le compte de `userId` (alice par défaut). */
  const recordScore = (score: number, game = 'clicker', userId = alice) =>
    asServer(db, () =>
      db.query('insert into public.scores (user_id, game_slug, score) values ($1, $2, $3)', [userId, game, score]),
    )
  /** Insertion tentée depuis le navigateur, avec supabase-js : user_id rempli par auth.uid(). */
  const insertFromBrowser = (userId: string | null, score = 42) =>
    as(db, userId, () => db.query(`insert into public.scores (game_slug, score) values ('clicker', $1)`, [score]))
  const scoresOf = async (userId: string) =>
    (await db.query('select score from public.scores where user_id = $1 order by id', [userId])).rows.map((r) =>
      Number(r.score),
    )

  beforeEach(async () => {
    alice = await createUser(db, 'alice')
    bob = await createUser(db, 'bob')
  })

  test('le backend enregistre le score d’un joueur, rattaché à son compte', async () => {
    await recordScore(42)

    expect(await scoresOf(alice)).toEqual([42])
  })

  test('un joueur connecté ne peut pas écrire de score depuis le navigateur, même le sien', async () => {
    await expect(insertFromBrowser(alice)).rejects.toMatchObject({ code: '42501' })
    expect(await scoresOf(alice)).toEqual([])
  })

  test('un joueur ne peut pas non plus écrire au nom d’un autre', async () => {
    await expect(
      as(db, alice, () =>
        db.query(`insert into public.scores (user_id, game_slug, score) values ($1, 'clicker', 300)`, [bob]),
      ),
    ).rejects.toMatchObject({ code: '42501' })
    expect(await scoresOf(bob)).toEqual([])
  })

  test('un visiteur non connecté ne peut pas écrire de score', async () => {
    await expect(insertFromBrowser(null)).rejects.toMatchObject({ code: '42501' })
  })

  test('un jeu inactif refuse les scores, même ceux du backend', async () => {
    await db.query(`update public.games set is_active = false where slug = 'clicker'`)

    await expect(recordScore(1)).rejects.toMatchObject({ code: '55000' })
    expect(await scoresOf(alice)).toEqual([])
  })

  test('un jeu absent du catalogue refuse les scores', async () => {
    await expect(recordScore(1, 'inconnu')).rejects.toMatchObject({
      code: '23503',
      constraint: 'scores_game_slug_fkey',
    })
  })

  // Valeurs limites basses : -1 refusé, 0 accepté
  test('refuse un score négatif', async () => {
    await expect(recordScore(-1)).rejects.toMatchObject({ code: '23514' })
  })

  test('accepte un score nul', async () => {
    await recordScore(0)

    expect(await scoresOf(alice)).toEqual([0])
  })

  // Valeurs limites hautes autour de games.max_score (300 pour le Clicker) : 299, 300, 301
  test.each([299, 300])('accepte %d (≤ max_score)', async (score) => {
    await recordScore(score)

    expect(await scoresOf(alice)).toEqual([score])
  })

  test('refuse 301 (> max_score), même pour le backend', async () => {
    await expect(recordScore(301)).rejects.toMatchObject({ code: '23514' })
    expect(await scoresOf(alice)).toEqual([])
  })

  test('sans max_score, un grand score est accepté', async () => {
    await db.query(`update public.games set max_score = null where slug = 'clicker'`)

    await recordScore(1_000_000)

    expect(await scoresOf(alice)).toEqual([1_000_000])
  })

  test('un score enregistré ne peut être ni modifié ni supprimé par le joueur', async () => {
    await recordScore(10)

    await expect(as(db, alice, () => db.query('update public.scores set score = 300'))).rejects.toMatchObject({
      code: '42501',
    })
    await expect(as(db, alice, () => db.query('delete from public.scores'))).rejects.toMatchObject({ code: '42501' })
    expect(await scoresOf(alice)).toEqual([10])
  })

  test('le classement garde le meilleur score de chaque joueur et compte ses parties, lisible sans compte', async () => {
    await recordScore(10)
    await recordScore(30)
    await recordScore(20, 'clicker', bob)

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
