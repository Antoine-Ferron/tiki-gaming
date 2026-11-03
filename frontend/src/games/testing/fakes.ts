// Fakes en mémoire des ports du SDK, pour tester un jeu ou la plateforme sans réseau :
//   const ctx = createGameContext(game, player, fakeDeps())
import type { Json } from '@/lib/database.types'
import type { GameDeps } from '../sdk'
import type { KeyValueStorage, SaveStore, ScoreRepository } from '../ports'
import type { LeaderboardEntry } from '../types'

export type StoredScore = { gameSlug: string; userId: string; username: string; score: number; metadata: Json }

/** Scores en mémoire ; `failNext(error, n)` fait échouer les n prochains envois pour simuler une panne. */
export class FakeScores implements ScoreRepository {
  readonly rows: StoredScore[] = []
  private failures: unknown[] = []

  constructor(private readonly player: { id: string; username: string } = { id: 'player-1', username: 'joueur' }) {}

  failNext(error: unknown, times = 1) {
    this.failures.push(...Array<unknown>(times).fill(error))
  }

  async insert(gameSlug: string, score: number, metadata: Json) {
    const failure = this.failures.shift()
    if (failure !== undefined) throw failure
    this.rows.push({ gameSlug, userId: this.player.id, username: this.player.username, score, metadata })
  }

  async leaderboard(gameSlug: string, limit: number): Promise<LeaderboardEntry[]> {
    const best = new Map<string, LeaderboardEntry>()
    for (const row of this.rows.filter((r) => r.gameSlug === gameSlug)) {
      const current = best.get(row.userId)
      best.set(row.userId, {
        game_slug: gameSlug,
        user_id: row.userId,
        username: row.username,
        avatar_url: null,
        best_score: Math.max(current?.best_score ?? row.score, row.score),
        games_played: (current?.games_played ?? 0) + 1,
        last_played_at: new Date(0).toISOString(),
      })
    }
    return [...best.values()].sort((a, b) => b.best_score - a.best_score).slice(0, limit)
  }

  async best(gameSlug: string, userId: string) {
    return (await this.leaderboard(gameSlug, Infinity)).find((e) => e.user_id === userId) ?? null
  }
}

export class FakeSaves implements SaveStore {
  readonly data = new Map<string, Json>()

  async load(gameSlug: string) {
    return this.data.get(gameSlug) ?? null
  }

  async save(gameSlug: string, data: Json) {
    this.data.set(gameSlug, data)
  }

  async clear(gameSlug: string) {
    this.data.delete(gameSlug)
  }
}

export class MemoryStorage implements KeyValueStorage {
  readonly items = new Map<string, string>()

  getItem(key: string) {
    return this.items.get(key) ?? null
  }

  setItem(key: string, value: string) {
    this.items.set(key, value)
  }

  removeItem(key: string) {
    this.items.delete(key)
  }
}

export function fakeDeps(overrides: Partial<GameDeps> = {}): GameDeps & { saves: FakeSaves } {
  const saves = new FakeSaves()
  return { scores: new FakeScores(), playerSaves: () => saves, storage: new MemoryStorage(), saves, ...overrides }
}
