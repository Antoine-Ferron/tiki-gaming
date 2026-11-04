import { beforeEach, expect, test } from 'vitest'
import { as, createUser, describeDb, useDatabase } from './db'

// Les expéditions gardent la graine de l'étage, donc la carte cachée : seul le backend (service_role) y accède.
describeDb('expéditions Prismine (accès réservé au backend)', () => {
  const db = useDatabase()
  let alice: string
  let runId: string

  // Le backend écrit hors RLS, comme SupabaseRunRepository avec la clé service_role.
  const insertRun = (userId: string | null) =>
    db
      .query<{ id: string }>(
        `insert into public.prismine_runs (id, user_id, state) values (gen_random_uuid(), $1, '{"seed": 42}') returning id`,
        [userId],
      )
      .then((r) => r.rows[0].id)
  const runCount = async () => Number((await db.query('select count(*) from public.prismine_runs')).rows[0].count)

  beforeEach(async () => {
    alice = await createUser(db, 'alice')
    runId = await insertRun(alice)
  })

  test('un joueur ne peut pas lire sa propre expédition (la carte cachée reste secrète)', async () => {
    await expect(as(db, alice, () => db.query('select state from public.prismine_runs'))).rejects.toMatchObject({
      code: '42501',
    })
  })

  test('un visiteur non connecté ne peut pas lire les expéditions', async () => {
    await expect(as(db, null, () => db.query('select state from public.prismine_runs'))).rejects.toMatchObject({
      code: '42501',
    })
  })

  test('un joueur ne peut ni créer, ni modifier, ni effacer une expédition', async () => {
    await expect(
      as(db, alice, () =>
        db.query(`insert into public.prismine_runs (id, user_id, state) values (gen_random_uuid(), $1, '{}')`, [alice]),
      ),
    ).rejects.toMatchObject({ code: '42501' })
    await expect(
      as(db, alice, () => db.query(`update public.prismine_runs set state = '{"seed": 0}' where id = $1`, [runId])),
    ).rejects.toMatchObject({ code: '42501' })
    await expect(
      as(db, alice, () => db.query('delete from public.prismine_runs where id = $1', [runId])),
    ).rejects.toMatchObject({ code: '42501' })

    const { rows } = await db.query('select state from public.prismine_runs where id = $1', [runId])
    expect(rows).toEqual([{ state: { seed: 42 } }])
  })

  test('une expédition d’invité n’a pas de compte rattaché', async () => {
    await insertRun(null)

    expect(await runCount()).toBe(2)
  })

  test('chaque mise à jour rafraîchit updated_at (base de la purge des expéditions inactives)', async () => {
    // Créée inactive depuis un jour : le trigger ne joue qu'à la mise à jour, pas à l'insertion.
    const { rows: stale } = await db.query<{ id: string }>(
      `insert into public.prismine_runs (id, user_id, state, updated_at)
       values (gen_random_uuid(), $1, '{}', now() - interval '1 day') returning id`,
      [alice],
    )
    await db.query(`update public.prismine_runs set state = '{"floor": 2}' where id = $1`, [stale[0].id])

    const { rows } = await db.query(
      `select updated_at > now() - interval '1 hour' as fresh from public.prismine_runs where id = $1`,
      [stale[0].id],
    )
    expect(rows).toEqual([{ fresh: true }])
  })

  test('la suppression du compte efface ses expéditions', async () => {
    await db.query('delete from auth.users where id = $1', [alice])

    expect(await runCount()).toBe(0)
  })
})
