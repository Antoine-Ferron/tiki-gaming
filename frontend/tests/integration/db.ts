import pg from 'pg'
import { afterAll, afterEach, beforeAll, beforeEach, describe, inject } from 'vitest'

/** `describe` ignoré si Docker est indisponible en local (voir globalSetup). */
export const describeDb = describe.skipIf(!inject('databaseUrl'))

/**
 * Connexion partagée par un fichier de tests. Chaque test s'exécute dans une transaction annulée à la fin :
 * aucun test ne voit les données d'un autre (pas de pollution d'état), sans recréer la base.
 */
export function useDatabase() {
  const db = new pg.Client({ connectionString: inject('databaseUrl') })
  beforeAll(() => db.connect())
  afterAll(() => db.end())
  beforeEach(() => db.query('begin'))
  afterEach(() => db.query('rollback'))
  return db
}

/** Crée un compte dans auth.users ; le trigger handle_new_user crée son profil. Renvoie son id. */
export async function createUser(db: pg.Client, username: string): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `insert into auth.users (id, email, raw_user_meta_data)
     values (gen_random_uuid(), $1, jsonb_build_object('username', $2::text)) returning id`,
    [`${username.toLowerCase()}-${crypto.randomUUID()}@test.local`, username],
  )
  return rows[0].id
}

/**
 * Exécute `fn` avec les droits d'un joueur (rôle authenticated + JWT) ou d'un visiteur (anon, userId null),
 * exactement comme PostgREST le fait pour une requête du front : la RLS s'applique.
 */
export function as<T>(db: pg.Client, userId: string | null, fn: () => Promise<T>): Promise<T> {
  const role = userId ? 'authenticated' : 'anon'
  return withRole(db, role, userId ?? '', JSON.stringify(userId ? { sub: userId, role } : { role }), fn)
}

/**
 * Exécute `fn` avec les droits du backend Java (clé service_role, comme pour POST /api/scores) : la RLS ne
 * s'applique pas, seuls les privilèges, contraintes et triggers protègent les données.
 */
export function asServer<T>(db: pg.Client, fn: () => Promise<T>): Promise<T> {
  return withRole(db, 'service_role', '', JSON.stringify({ role: 'service_role' }), fn)
}

async function withRole<T>(db: pg.Client, role: string, sub: string, claims: string, fn: () => Promise<T>): Promise<T> {
  await db.query('savepoint as_user')
  try {
    await db.query(
      `select set_config('role', $1, true), set_config('request.jwt.claim.sub', $2, true),
              set_config('request.jwt.claims', $3, true)`,
      [role, sub, claims],
    )
    const result = await fn()
    await db.query(
      `reset role; select set_config('request.jwt.claim.sub', '', true), set_config('request.jwt.claims', '', true)`,
    )
    await db.query('release savepoint as_user')
    return result
  } catch (err) {
    // Annule l'instruction en échec (et le changement de rôle) sans perdre le reste du test.
    await db.query('rollback to savepoint as_user')
    throw err
  }
}
