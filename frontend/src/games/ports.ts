import type { Json } from '@/lib/database.types'
import type { LeaderboardEntry } from './types'

/**
 * Ports du SDK : ce dont le contexte de jeu a besoin, sans savoir où sont les données.
 * Adaptateurs de production dans ./adapters, fakes en mémoire dans ./testing/fakes.
 * Toute erreur levée par un adaptateur est une GameError (voir ./errors).
 */
export interface ScoreRepository {
  insert(gameSlug: string, score: number, metadata: Json): Promise<void>
  /** Meilleur score de chaque joueur, du plus haut au plus bas. */
  leaderboard(gameSlug: string, limit: number): Promise<LeaderboardEntry[]>
  best(gameSlug: string, userId: string): Promise<LeaderboardEntry | null>
}

/** Sauvegarde d'un seul joueur (le compte connecté, ou l'appareil en invité). */
export interface SaveStore {
  load(gameSlug: string): Promise<Json | null>
  save(gameSlug: string, data: Json): Promise<void>
  clear(gameSlug: string): Promise<void>
}

/** Sous-ensemble de l'API Web Storage utilisé par le SDK (localStorage en production). */
export type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/** État de la connexion temps réel d'une salle. */
export type RealtimeStatus = 'connecting' | 'open' | 'reconnecting' | 'closed'

/** Évènement reçu sur le canal d'une salle (voir fr.tikigaming.realtime.RoomEvent côté backend). */
export type RoomEvent<T = unknown> = { type: string; payload: T; code: string; serverTime: string }

/** Types réservés par le socle : un jeu ne doit jamais nommer une de ses actions ainsi (voir `send`). */
export const ROOM_EVENT_TYPES = { ROOM_UPDATED: 'ROOM_UPDATED', PLAYER_LEFT: 'PLAYER_LEFT' } as const

/**
 * Connexion à une salle de jeu (créée ou rejointe par `Realtime.createRoom`/`joinRoom`). La reconnexion après
 * une coupure réseau est automatique et transparente : `join` est renvoyé avec le même code, le siège est
 * retrouvé côté serveur et les abonnements sont rétablis, sans action du jeu.
 */
export interface RealtimeConnection {
  readonly code: string
  readonly seat: number
  readonly playerCount: number
  /**
   * Diffuse une action publique à tous les joueurs assis. `actionId` déduplique un double envoi : pour qu'une
   * retentative soit ignorée côté serveur, le jeu doit réutiliser le même `actionId` que l'envoi initial.
   * `type` ne doit pas être un des types réservés (`ROOM_EVENT_TYPES`) : le serveur refuse l'action sinon.
   */
  send(type: string, data?: unknown, actionId?: string): void
  /** Écoute les évènements d'un type donné sur le canal de la salle. Renvoie une fonction pour se désabonner. */
  on<T = unknown>(type: string, handler: (event: RoomEvent<T>) => void): () => void
  onStatusChange(handler: (status: RealtimeStatus) => void): () => void
  /** Quitte la salle (libère le siège côté serveur) et ferme les abonnements locaux. */
  close(): void
}

/** Socle temps réel du jeu courant (scopé sur son `gameSlug`, voir ./sdk.ts). */
export interface Realtime {
  /** Crée une salle et y place le joueur courant au premier siège. */
  createRoom(maxPlayers?: number): Promise<RealtimeConnection>
  /** Rejoint une salle existante par son code ; idempotent (un compte déjà assis retrouve sa place). */
  joinRoom(code: string): Promise<RealtimeConnection>
}
