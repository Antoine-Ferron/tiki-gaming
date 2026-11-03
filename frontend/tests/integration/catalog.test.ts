import { expect, test } from 'vitest'
import { GAME_CATEGORIES } from '@/games/categories'
import { games } from '@/games/registry'
import { describeDb, useDatabase } from './db'

// Le catalogue est déclaré deux fois (registre du front, table public.games) : ce test détecte toute divergence.
describeDb('cohérence du catalogue front / base', () => {
  const db = useDatabase()

  test.each(games.map((g) => [g.slug, g] as const))('%s existe en base avec la même définition', async (slug, game) => {
    const { rows } = await db.query('select category, is_active, max_score from public.games where slug = $1', [slug])

    expect(rows).toHaveLength(1)
    expect({ ...rows[0], max_score: rows[0].max_score === null ? null : Number(rows[0].max_score) }).toEqual({
      category: game.category,
      is_active: true,
      max_score: game.scoreLimits?.max ?? null,
    })
  })

  test('GAME_CATEGORIES liste exactement les catégories autorisées par games_category_check', async () => {
    const { rows } = await db.query(
      `select pg_get_constraintdef(oid) as def from pg_constraint where conname = 'games_category_check'`,
    )
    const allowed = [...rows[0].def.matchAll(/'([a-z]+)'::text/g)].map((m) => m[1])

    expect(allowed.sort()).toEqual(Object.keys(GAME_CATEGORIES).sort())
  })
})
