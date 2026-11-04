import pg from 'pg'
import { GenericContainer, getContainerRuntimeClient, Wait, type StartedTestContainer } from 'testcontainers'
import type { TestProject } from 'vitest/node'
import { applyMigrations } from '../../scripts/migrations.mjs'

// Même image que la base de production (PostgreSQL 17.11) : rôles anon / authenticated, schéma auth, auth.uid().
export const IMAGE = process.env.SUPABASE_POSTGRES_IMAGE ?? 'supabase/postgres:17.11.0.018'
const PASSWORD = 'postgres'

declare module 'vitest' {
  export interface ProvidedContext {
    /** URL de la base de test, ou '' si Docker est indisponible (tests ignorés en local). */
    databaseUrl: string
  }
}

let container: StartedTestContainer | undefined

async function dockerAvailable(): Promise<boolean> {
  try {
    await getContainerRuntimeClient()
    return true
  } catch {
    return false
  }
}

export async function setup(project: TestProject) {
  if (!(await dockerAvailable())) {
    // En CI, l'absence de Docker est une erreur ; en local, on prévient et on ignore les tests.
    if (process.env.CI) throw new Error('Docker est requis pour les tests d’intégration')
    console.warn('\n⚠ Docker indisponible : tests d’intégration ignorés. Démarre Docker pour les lancer.\n')
    project.provide('databaseUrl', '')
    return
  }

  container = await new GenericContainer(IMAGE)
    .withEnvironment({ POSTGRES_PASSWORD: PASSWORD })
    .withExposedPorts(5432)
    // Pendant son initialisation, l'image n'écoute que sur le socket local : le port TCP répond une fois prête.
    .withWaitStrategy(Wait.forSuccessfulCommand('pg_isready -U postgres -h 127.0.0.1'))
    .withStartupTimeout(120_000)
    .start()

  const databaseUrl = `postgres://postgres:${PASSWORD}@${container.getHost()}:${container.getMappedPort(5432)}/postgres`
  const client = new pg.Client({ connectionString: databaseUrl })
  await client.connect()
  try {
    await applyMigrations(client)
  } finally {
    await client.end()
  }
  project.provide('databaseUrl', databaseUrl)
}

export async function teardown() {
  await container?.stop()
}
