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
