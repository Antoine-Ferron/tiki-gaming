import { beforeEach, expect, test } from 'vitest'
import { as, asServer, createUser, describeDb, useDatabase } from './db'

// RGPD, droit à l'effacement (art. 17) : DELETE /api/auth/account supprime le compte Supabase (auth.users) ; les
// clés étrangères « on delete cascade » doivent effacer tout ce qui le concerne, sans toucher aux autres joueurs.
describeDb('suppression du compte (RGPD, droit à l’effacement)', () => {
  const db = useDatabase()
  let alice: string
  let bob: string

  const recordScore = (userId: string, score: number) =>
    asServer(db, () =>
      db.query(`insert into public.scores (user_id, game_slug, score) values ($1, 'clicker', $2)`, [userId, score]),
    )
  const save = (userId: string) =>
    as(db, userId, () =>
      db.query(`insert into public.game_saves (user_id, game_slug, data) values ($1, 'clicker', '{"clics": 3}')`, [
        userId,
      ]),
    )
  /** Lignes restantes du joueur, table par table. */
  const traces = async (userId: string) => {
    const count = async (sql: string) => Number((await db.query(sql, [userId])).rows[0].count)
    return {
      compte: await count('select count(*) from auth.users where id = $1'),
      profil: await count('select count(*) from public.profiles where id = $1'),
      scores: await count('select count(*) from public.scores where user_id = $1'),
      sauvegardes: await count('select count(*) from public.game_saves where user_id = $1'),
      classement: await count('select count(*) from public.leaderboard where user_id = $1'),
    }
  }
  const nothing = { compte: 0, profil: 0, scores: 0, sauvegardes: 0, classement: 0 }

  beforeEach(async () => {
    alice = await createUser(db, 'alice')
    bob = await createUser(db, 'bob')
    for (const id of [alice, bob]) {
      await recordScore(id, 10)
      await recordScore(id, 20)
      await save(id)
    }
  })

  test('effacer le compte efface le profil, les scores, les sauvegardes et la ligne du classement', async () => {
    expect(await traces(alice)).toEqual({ compte: 1, profil: 1, scores: 2, sauvegardes: 1, classement: 1 })

    await db.query('delete from auth.users where id = $1', [alice])

    expect(await traces(alice)).toEqual(nothing)
  })

  test('les données des autres joueurs restent intactes', async () => {
    await db.query('delete from auth.users where id = $1', [alice])

    expect(await traces(bob)).toEqual({ compte: 1, profil: 1, scores: 2, sauvegardes: 1, classement: 1 })
  })

  test('un joueur ne peut pas effacer son compte en contournant le backend', async () => {
    await expect(as(db, alice, () => db.query('delete from auth.users where id = $1', [alice]))).rejects.toMatchObject({
      code: '42501',
    })
    expect((await traces(alice)).compte).toBe(1)
  })
})
