import { beforeEach, expect, test } from 'vitest'
import { as, asServer, createUser, describeDb, useDatabase } from './db'

// Rush Hour sur une vraie base PostgreSQL (image de prod, migrations du dépôt rejouées, aucun mock de base).
// On vérifie ce que nos migrations Rush Hour ont posé : la ligne du catalogue et le plafond du score total
// (max_score = 20 000, soit 20 niveaux à 1000 points), puis la sauvegarde de la progression sous RLS.
describeDb('Rush Hour (catalogue, plafond du score, progression)', () => {
  const db = useDatabase()
  let alice: string
  let bob: string

  /** Score total enregistré par le backend (POST /api/scores), pour le compte d'Alice. */
  const recordTotal = (score: number) =>
    asServer(db, () =>
      db.query(`insert into public.scores (user_id, game_slug, score) values ($1, 'rush-hour', $2)`, [alice, score]),
    )
  const totalsOf = async (userId: string) =>
    (
      await db.query(`select score from public.scores where user_id = $1 and game_slug = 'rush-hour'`, [userId])
    ).rows.map((r) => Number(r.score))

  /** Progression telle que le jeu l'écrit (services/progress.ts) : records par niveau et statistiques de génération. */
  const saveProgress = (userId: string, data: object) =>
    as(db, userId, () =>
      db.query(
        `insert into public.game_saves (user_id, game_slug, data) values ($1, 'rush-hour', $2)
         on conflict (user_id, game_slug) do update set data = excluded.data`,
        [userId, data],
      ),
    )
  const readProgress = (userId: string) =>
    as(db, userId, () => db.query(`select data from public.game_saves where game_slug = 'rush-hour'`)).then((r) =>
      r.rows.map((row) => row.data),
    )

  beforeEach(async () => {
    alice = await createUser(db, 'alice')
    bob = await createUser(db, 'bob')
  })

  test('Rush Hour est au catalogue : jeu solo actif, score total plafonné à 20 000', async () => {
    const { rows } = await db.query(
      `select category, is_active, max_score::int as max_score from public.games where slug = 'rush-hour'`,
    )

    expect(rows).toEqual([{ category: 'solo', is_active: true, max_score: 20000 }])
  })

  // Valeurs limites autour du plafond : 19 999 et 20 000 acceptés, 20 001 refusé
  test.each([19999, 20000])('accepte un score total de %d (≤ 20 000)', async (score) => {
    await recordTotal(score)

    expect(await totalsOf(alice)).toEqual([score])
  })

  test('refuse un score total de 20 001 (> 20 000), même envoyé par le backend', async () => {
    await expect(recordTotal(20001)).rejects.toMatchObject({ code: '23514' })
    expect(await totalsOf(alice)).toEqual([])
  })

  test('un joueur sauvegarde sa progression Rush Hour et la relit à l’identique', async () => {
    const progress = { version: 1, best: { 1: 1000, 2: 800 }, generated: { facile: { won: 3, best: 950 } } }

    await saveProgress(alice, progress)

    expect(await readProgress(alice)).toEqual([progress])
  })

  test('un joueur ne voit pas la progression Rush Hour d’un autre', async () => {
    await saveProgress(alice, { version: 1, best: { 1: 1000 } })

    expect(await readProgress(bob)).toEqual([])
  })
})
