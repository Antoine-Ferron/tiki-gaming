import { beforeEach, expect, test } from 'vitest'
import { MAX_SCORE, newSave, saveSchema } from '@/games/mini-gta/domain/save'
import { as, asServer, createUser, describeDb, useDatabase } from './db'

// MiniGTA sur une vraie base PostgreSQL (image de prod, migrations du dépôt rejouées par globalSetup, aucun mock
// de base), chaque test dans une transaction annulée. On vérifie ce que la migration add_game_mini_gta a posé
// (plafond du score : tout l'argent gagné, 1 000 000) et la sauvegarde de la progression sous RLS.
describeDb('MiniGTA (plafond du score, classement, progression)', () => {
  const db = useDatabase()
  let alice: string
  let bob: string

  /** Score enregistré par le backend (POST /api/scores) pour le compte d'Alice : l'argent gagné au total. */
  const recordEarned = (score: number, userId = alice) =>
    asServer(db, () =>
      db.query(`insert into public.scores (user_id, game_slug, score) values ($1, 'mini-gta', $2)`, [userId, score]),
    )
  const earnedOf = async (userId: string) =>
    (
      await db.query(`select score from public.scores where user_id = $1 and game_slug = 'mini-gta'`, [userId])
    ).rows.map((r) => Number(r.score))

  /** Progression telle que le jeu l'écrit avec ctx.save (session.ts), en upsert comme le SDK. */
  const saveProgress = (userId: string, data: object) =>
    as(db, userId, () =>
      db.query(
        `insert into public.game_saves (user_id, game_slug, data) values ($1, 'mini-gta', $2)
         on conflict (user_id, game_slug) do update set data = excluded.data`,
        [userId, data],
      ),
    )
  const readSaves = (userId: string) =>
    as(db, userId, () => db.query(`select user_id, data from public.game_saves where game_slug = 'mini-gta'`)).then(
      (r) => r.rows,
    )

  beforeEach(async () => {
    alice = await createUser(db, 'alice')
    bob = await createUser(db, 'bob')
  })

  test('le plafond en base est celui du jeu (MAX_SCORE)', async () => {
    const { rows } = await db.query(`select max_score from public.games where slug = 'mini-gta'`)

    expect(Number(rows[0].max_score)).toBe(MAX_SCORE)
  })

  // Valeurs limites autour du plafond : 999 999 et 1 000 000 acceptés, 1 000 001 refusé même pour le backend.
  test.each([MAX_SCORE - 1, MAX_SCORE])('accepte %i $ gagnés (≤ plafond)', async (score) => {
    await recordEarned(score)

    expect(await earnedOf(alice)).toEqual([score])
  })

  test('refuse 1 000 001 $ gagnés (> plafond), même pour le backend', async () => {
    await expect(recordEarned(MAX_SCORE + 1)).rejects.toMatchObject({ code: '23514' })
    expect(await earnedOf(alice)).toEqual([])
  })

  test('le classement garde la meilleure partie de chaque joueur', async () => {
    await recordEarned(800)
    await recordEarned(3300)
    await recordEarned(1500, bob)

    const { rows } = await db.query(
      `select username, best_score from public.leaderboard where game_slug = 'mini-gta' order by best_score desc`,
    )

    expect(rows.map((r) => [r.username, Number(r.best_score)])).toEqual([
      ['alice', 3300],
      ['bob', 1500],
    ])
  })

  test('une progression sauvegardée (jsonb) se relit à l’identique et reste valide pour le jeu', async () => {
    const progress = {
      ...newSave(),
      money: 2070,
      totalEarned: 3000,
      inventory: [{ id: 'shotgun', clip: 8, ammo: 16 }],
      completedMissions: ['special'],
      stats: { kills: 3, wantedMax: 2, playTime: 125.5 },
    }

    await saveProgress(alice, newSave())
    await saveProgress(alice, progress)

    const rows = await readSaves(alice)
    expect(rows).toHaveLength(1)
    expect(saveSchema.parse(rows[0].data)).toEqual(progress)
  })

  test('un joueur ne voit ni ne modifie la progression d’un autre', async () => {
    await saveProgress(alice, { ...newSave(), money: 9999 })

    expect(await readSaves(bob)).toEqual([])
    const updated = await as(db, bob, () =>
      db.query(`update public.game_saves set data = '{"triche":true}' where user_id = $1`, [alice]),
    )
    expect(updated.rowCount).toBe(0)
    expect((await readSaves(alice))[0].data.money).toBe(9999)
  })
})
