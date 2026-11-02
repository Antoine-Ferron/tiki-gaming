import { supabase } from '@/lib/supabase'
import type { Json } from '@/lib/database.types'
import type { GameContext, Player } from './types'

export function createGameContext(gameSlug: string, player: Player | null): GameContext {
  return player ? createPlayerContext(gameSlug, player) : createGuestContext(gameSlug)
}

async function fetchLeaderboard(gameSlug: string, limit: number) {
  const { data, error } = await supabase
    .from('leaderboard')
    .select('*')
    .eq('game_slug', gameSlug)
    .order('best_score', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data
}

function createPlayerContext(gameSlug: string, player: Player): GameContext {
  return {
    gameSlug,
    player,
    isGuest: false,

    async submitScore(score, metadata = {}) {
      // user_id est rempli par défaut côté base (auth.uid()) et vérifié par la RLS.
      const { error } = await supabase.from('scores').insert({ game_slug: gameSlug, score, metadata })
      if (error) throw error
      return true
    },

    getLeaderboard: (limit = 10) => fetchLeaderboard(gameSlug, limit),

    async getMyBest() {
      const { data, error } = await supabase
        .from('leaderboard')
        .select('*')
        .eq('game_slug', gameSlug)
        .eq('user_id', player.id)
        .maybeSingle()
      if (error) throw error
      return data
    },

    async loadSave<T extends Json = Json>() {
      const { data, error } = await supabase
        .from('game_saves')
        .select('data')
        .eq('game_slug', gameSlug)
        .eq('user_id', player.id)
        .maybeSingle()
      if (error) throw error
      return (data?.data as T | undefined) ?? null
    },

    async save(data) {
      const { error } = await supabase
        .from('game_saves')
        .upsert({ user_id: player.id, game_slug: gameSlug, data }, { onConflict: 'user_id,game_slug' })
      if (error) throw error
    },

    async clearSave() {
      const { error } = await supabase.from('game_saves').delete().eq('game_slug', gameSlug).eq('user_id', player.id)
      if (error) throw error
    },
  }
}

function createGuestContext(gameSlug: string): GameContext {
  const storageKey = `tiki:guest-save:${gameSlug}`

  return {
    gameSlug,
    player: null,
    isGuest: true,

    async submitScore() {
      return false
    },

    getLeaderboard: (limit = 10) => fetchLeaderboard(gameSlug, limit),

    async getMyBest() {
      return null
    },

    async loadSave<T extends Json = Json>() {
      try {
        const raw = localStorage.getItem(storageKey)
        return raw ? (JSON.parse(raw) as T) : null
      } catch {
        return null
      }
    },

    async save(data) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(data))
      } catch {
        // stockage indisponible (navigation privée…) : la partie continue sans sauvegarde
      }
    },

    async clearSave() {
      try {
        localStorage.removeItem(storageKey)
      } catch {
        // idem
      }
    },
  }
}
