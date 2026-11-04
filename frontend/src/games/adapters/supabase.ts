import { ApiError, apiPost } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import { GameError, toGameError } from '../errors'
import type { SaveStore, ScoreRepository } from '../ports'

type Result<T> = { data: T; error: unknown; status: number }

/** Renvoie les données d'une réponse supabase-js, ou lève l'erreur traduite pour le joueur. */
function unwrap<T>({ data, error, status }: Result<T>): T {
  if (error) throw toGameError(error, status)
  return data
}

/** supabase-js ne rejette pas sur erreur HTTP, mais une exception reste possible (fetch interrompu…). */
async function run<T>(query: PromiseLike<Result<T>>): Promise<T> {
  try {
    return unwrap(await query)
  } catch (err) {
    throw toGameError(err)
  }
}

export const supabaseScores: ScoreRepository = {
  async insert(gameSlug, score, metadata) {
    // Seul le backend écrit dans public.scores, pour le compte de la session HTTP : le navigateur n'en a pas le droit.
    try {
      await apiPost('/scores', { gameSlug, score, metadata })
    } catch (err) {
      // Score refusé (au-dessus du maximum, détails invalides…) : le message du backend s'adresse déjà au joueur.
      if (err instanceof ApiError && err.status === 400) throw new GameError('invalid', err.message, { cause: err })
      throw toGameError(err)
    }
  },

  async leaderboard(gameSlug, limit) {
    const rows = await run(
      supabase
        .from('leaderboard')
        .select('*')
        .eq('game_slug', gameSlug)
        .order('best_score', { ascending: false })
        .order('username')
        .limit(limit),
    )
    return rows ?? []
  },

  best(gameSlug, userId) {
    return run(supabase.from('leaderboard').select('*').eq('game_slug', gameSlug).eq('user_id', userId).maybeSingle())
  },
}

export function supabaseSaves(userId: string): SaveStore {
  return {
    async load(gameSlug) {
      const row = await run(
        supabase.from('game_saves').select('data').eq('game_slug', gameSlug).eq('user_id', userId).maybeSingle(),
      )
      return row?.data ?? null
    },

    async save(gameSlug, data) {
      await run(
        supabase
          .from('game_saves')
          .upsert({ user_id: userId, game_slug: gameSlug, data }, { onConflict: 'user_id,game_slug' }),
      )
    },

    async clear(gameSlug) {
      await run(supabase.from('game_saves').delete().eq('game_slug', gameSlug).eq('user_id', userId))
    },
  }
}
