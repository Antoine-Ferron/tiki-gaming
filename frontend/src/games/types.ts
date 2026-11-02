import type { ComponentType, LazyExoticComponent } from 'react'
import type { Json, Views } from '@/lib/database.types'

export type Player = { id: string; username: string }

export type LeaderboardEntry = Views<'leaderboard'>

export type GameMode = 'solo' | 'multiplayer'

/**
 * API mise à disposition de chaque jeu par la plateforme.
 * En mode invité (jeu solo sans connexion) : `player` vaut null, les scores ne sont
 * pas enregistrés et la sauvegarde est stockée localement dans le navigateur.
 * Un jeu ne doit PAS importer `supabase` directement : tout passe par ce contexte,
 * déjà scopé sur le jeu courant et le joueur connecté.
 */
export interface GameContext {
  readonly gameSlug: string
  /** Joueur connecté, ou null en mode invité. */
  readonly player: Player | null
  readonly isGuest: boolean
  /** Enregistre une partie terminée (plus haut = meilleur). Renvoie false en invité (rien n'est enregistré). */
  submitScore(score: number, metadata?: Json): Promise<boolean>
  /** Meilleurs scores du jeu, un par joueur. */
  getLeaderboard(limit?: number): Promise<LeaderboardEntry[]>
  /** Meilleur score du joueur courant, ou null (toujours null en invité). */
  getMyBest(): Promise<LeaderboardEntry | null>
  /** Charge la sauvegarde du joueur pour ce jeu, ou null (localStorage en invité). */
  loadSave<T extends Json = Json>(): Promise<T | null>
  /** Écrase la sauvegarde du joueur pour ce jeu. */
  save(data: Json): Promise<void>
  clearSave(): Promise<void>
}

export type GameProps = { ctx: GameContext }

export interface GameDefinition {
  /** Identifiant unique, = games.slug en base et segment d'URL /games/:slug */
  slug: string
  title: string
  description: string
  thumbnail?: string
  /** 'solo' : jouable sans compte (invité). 'multiplayer' : connexion obligatoire. */
  mode: GameMode
  /** Chargé à la demande : le code du jeu n'est téléchargé qu'à l'ouverture. */
  component: LazyExoticComponent<ComponentType<GameProps>>
}
