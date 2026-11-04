import { beforeEach, expect, test } from 'vitest'
import { as, createUser, describeDb, useDatabase } from './db'

describeDb('sauvegardes (RLS)', () => {
  const db = useDatabase()
  let alice: string
  let bob: string

  const saveAs = (userId: string, data: object) =>
    as(db, userId, () =>
      db.query(
        `insert into public.game_saves (user_id, game_slug, data) values ($1, 'clicker', $2)
         on conflict (user_id, game_slug) do update set data = excluded.data`,
        [userId, data],
      ),
    )
  const readSaves = (userId: string | null) =>
    as(db, userId, () => db.query('select user_id, data from public.game_saves')).then((r) => r.rows)

  beforeEach(async () => {
    alice = await createUser(db, 'alice')
    bob = await createUser(db, 'bob')
  })

  test('un joueur écrit, relit et écrase sa sauvegarde', async () => {
    await saveAs(alice, { totalClicks: 1 })
    await saveAs(alice, { totalClicks: 2 })

    expect(await readSaves(alice)).toEqual([{ user_id: alice, data: { totalClicks: 2 } }])
  })

  test('un joueur ne voit pas la sauvegarde d’un autre', async () => {
    await saveAs(alice, { totalClicks: 1 })

    expect(await readSaves(bob)).toEqual([])
  })

  test('un joueur ne peut ni écrire, ni modifier, ni effacer la sauvegarde d’un autre', async () => {
    await saveAs(alice, { totalClicks: 1 })

    await expect(saveAs(bob, { totalClicks: 999 }).then(() => null)).resolves.toBeNull() // sa propre ligne
    await expect(
      as(db, bob, () => db.query(`insert into public.game_saves (user_id, game_slug) values ($1, 'clicker')`, [alice])),
    ).rejects.toMatchObject({ code: '42501' })
    const updated = await as(db, bob, () =>
      db.query(`update public.game_saves set data = '{"triche":true}' where user_id = $1`, [alice]),
    )
    const deleted = await as(db, bob, () => db.query('delete from public.game_saves where user_id = $1', [alice]))

    expect([updated.rowCount, deleted.rowCount]).toEqual([0, 0])
    expect(await readSaves(alice)).toEqual([{ user_id: alice, data: { totalClicks: 1 } }])
  })

  test('un visiteur non connecté n’a aucun accès aux sauvegardes', async () => {
    await expect(readSaves(null)).rejects.toMatchObject({ code: '42501' })
  })
})

describeDb('profils', () => {
  const db = useDatabase()
  const usernameOf = async (id: string) =>
    (await db.query('select username from public.profiles where id = $1', [id])).rows[0]?.username

  test('l’inscription crée le profil avec le pseudo demandé', async () => {
    const id = await createUser(db, 'Anathos')

    expect(await usernameOf(id)).toBe('Anathos')
  })

  test('un pseudo déjà pris (casse comprise) est dédoublonné au lieu de faire échouer l’inscription', async () => {
    await createUser(db, 'alice')
    const second = await createUser(db, 'ALICE')

    expect(await usernameOf(second)).toBe('ALICE1')
  })

  test.each([
    ["Anath'os", 'Anathos'],
    ['ab', /^joueur_[0-9a-f]{8}$/],
    ['', /^joueur_[0-9a-f]{8}$/],
  ])('pseudo « %s » nettoyé en %s', async (requested, expected) => {
    const id = await createUser(db, requested)

    expect(await usernameOf(id)).toMatch(expected)
  })

  test('le pseudo est tronqué à 20 caractères avant dédoublonnage', async () => {
    const id = await createUser(db, 'a'.repeat(30))

    expect(await usernameOf(id)).toBe('a'.repeat(20))
  })

  // Frontières de la contrainte CHECK : 2 refusé, 3 et 24 acceptés, 25 refusé
  test.each([
    ['ab', false],
    ['abc', true],
    ['a'.repeat(24), true],
    ['a'.repeat(25), false],
    ['avec espace', false],
  ])('modifier son pseudo en « %s » : accepté = %s', async (username, accepted) => {
    const id = await createUser(db, 'alice')
    const update = as(db, id, () => db.query('update public.profiles set username = $1 where id = $2', [username, id]))

    if (accepted) await expect(update).resolves.toMatchObject({ rowCount: 1 })
    else await expect(update).rejects.toMatchObject({ code: '23514' })
  })

  test('un joueur ne peut pas modifier le profil d’un autre', async () => {
    const alice = await createUser(db, 'alice')
    const bob = await createUser(db, 'bob')

    const result = await as(db, bob, () =>
      db.query(`update public.profiles set username = 'pirate' where id = $1`, [alice]),
    )

    expect(result.rowCount).toBe(0)
    expect(await usernameOf(alice)).toBe('alice')
  })

  test('find_auth_user_id est réservé au backend (service_role)', async () => {
    const id = await createUser(db, 'alice')
    const [{ email }] = (await db.query('select email from auth.users where id = $1', [id])).rows

    await expect(as(db, id, () => db.query('select public.find_auth_user_id($1)', [email]))).rejects.toMatchObject({
      code: '42501',
    })
    await db.query(`select set_config('role', 'service_role', true)`)
    const { rows } = await db.query('select public.find_auth_user_id(upper($1)) as id', [email])
    expect(rows[0].id).toBe(id)
  })
})
