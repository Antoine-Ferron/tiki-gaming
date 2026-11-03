// Fakes en mémoire des ports du SDK, pour tester un jeu ou la plateforme sans réseau :
//   const ctx = createGameContext(game, player, fakeDeps())
import type { Json } from '@/lib/database.types'
import type { GameDeps } from '../sdk'
import type {
  KeyValueStorage,
  Realtime,
  RealtimeConnection,
  RealtimeStatus,
  RoomEvent,
  SaveStore,
  ScoreRepository,
} from '../ports'
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

type SentAction = { type: string; data: unknown; actionId?: string }

/**
 * Connexion de salle en mémoire : `send` enregistre l'action envoyée (vérifiable via `.sent`), `emit` simule un
 * évènement reçu du serveur (propre action ou celle d'un autre joueur). `send` ne déclenche pas `on` tout seul :
 * un test qui veut vérifier la diffusion appelle `emit` explicitement, comme le ferait le serveur.
 */
export class FakeRealtimeConnection implements RealtimeConnection {
  seat = 1
  playerCount = 1
  readonly sent: SentAction[] = []
  private readonly handlers = new Map<string, Set<(event: RoomEvent) => void>>()
  private readonly statusHandlers = new Set<(status: RealtimeStatus) => void>()

  constructor(readonly code: string) {}

  send(type: string, data?: unknown, actionId?: string) {
    this.sent.push({ type, data, actionId })
  }

  on<T = unknown>(type: string, handler: (event: RoomEvent<T>) => void) {
    const forType = this.handlers.get(type) ?? new Set()
    forType.add(handler as (event: RoomEvent) => void)
    this.handlers.set(type, forType)
    return () => forType.delete(handler as (event: RoomEvent) => void)
  }

  onStatusChange(handler: (status: RealtimeStatus) => void) {
    this.statusHandlers.add(handler)
    return () => this.statusHandlers.delete(handler)
  }

  close() {}

  /** Test uniquement (absent de `RealtimeConnection`) : simule un évènement reçu du serveur. */
  emit<T = unknown>(type: string, payload: T) {
    const event: RoomEvent<T> = { type, payload, code: this.code, serverTime: new Date().toISOString() }
    for (const handler of this.handlers.get(type) ?? []) handler(event)
  }

  /** Test uniquement : simule un changement d'état de connexion (coupure, reconnexion…). */
  setStatus(status: RealtimeStatus) {
    for (const handler of this.statusHandlers) handler(status)
  }
}

/** `failNextCreate`/`failNextJoin` font échouer la prochaine création/jonction, pour simuler une panne serveur. */
export class FakeRealtime implements Realtime {
  private nextCode = 1
  private createFailures: unknown[] = []
  private joinFailures: unknown[] = []

  failNextCreate(error: unknown) {
    this.createFailures.push(error)
  }

  failNextJoin(error: unknown) {
    this.joinFailures.push(error)
  }

  // Signature alignée sur Realtime.createRoom : le fake ne limite pas le nombre de joueurs.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async createRoom(_maxPlayers = 4): Promise<FakeRealtimeConnection> {
    const failure = this.createFailures.shift()
    if (failure !== undefined) throw failure
    const connection = new FakeRealtimeConnection(`ROOM-${this.nextCode++}`)
    connection.seat = 1
    connection.playerCount = 1
    return connection
  }

  async joinRoom(code: string): Promise<FakeRealtimeConnection> {
    const failure = this.joinFailures.shift()
    if (failure !== undefined) throw failure
    return new FakeRealtimeConnection(code)
  }
}

export function fakeDeps(overrides: Partial<GameDeps> = {}): GameDeps & { saves: FakeSaves } {
  const saves = new FakeSaves()
  return {
    scores: new FakeScores(),
    playerSaves: () => saves,
    storage: new MemoryStorage(),
    realtime: () => new FakeRealtime(),
    saves,
    ...overrides,
  }
}
