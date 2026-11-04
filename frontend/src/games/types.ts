import type { ComponentType, LazyExoticComponent } from 'react'
import type { Json, Views } from '@/lib/database.types'
import type { GameCategory } from './categories'
import type { ScoreLimits } from './domain/score'
import type { Realtime } from './ports'
import type { GameTheme } from './themes'

export type Player = { id: string; username: string }

export type LeaderboardEntry = Views<'leaderboard'>

export type GameMode = 'solo' | 'multiplayer'

/** Schéma de sauvegarde (un schéma Zod convient) : vérifie qu'une sauvegarde chargée a la forme attendue. */
export type SaveSchema<T> = { safeParse(data: unknown): { success: true; data: T } | { success: false } }

/**
 * API mise à disposition de chaque jeu par la plateforme.
 * En mode invité (jeu solo sans connexion) : `player` vaut null, les scores ne sont
 * pas enregistrés et la sauvegarde est stockée localement dans le navigateur.
 * Un jeu ne doit PAS importer `supabase` directement : tout passe par ce contexte,
 * déjà scopé sur le jeu courant et le joueur connecté.
 *
 * Les méthodes rejettent avec une GameError (./errors) dont le `message` peut être affiché tel quel au joueur.
 */
export interface GameContext {
  readonly gameSlug: string
  /** Joueur connecté, ou null en mode invité. */
  readonly player: Player | null
  readonly isGuest: boolean
  /**
   * Enregistre une partie terminée (plus haut = meilleur). Renvoie false en invité (rien n'est enregistré).
   * Le score est vérifié avant l'envoi (entier, 0 ≤ score ≤ scoreLimits.max) : sinon GameError 'invalid'.
   * Coupure réseau : le score est gardé sur l'appareil et renvoyé plus tard, GameError 'queued'.
   */
  submitScore(score: number, metadata?: Json): Promise<boolean>
  /** Meilleurs scores du jeu, un par joueur. */
  getLeaderboard(limit?: number): Promise<LeaderboardEntry[]>
  /** Meilleur score du joueur courant, ou null (toujours null en invité). */
  getMyBest(): Promise<LeaderboardEntry | null>
  /**
   * Charge la sauvegarde du joueur pour ce jeu, ou null (localStorage en invité).
   * Avec un schéma, une sauvegarde qui ne le respecte pas (corrompue, ancienne version) donne null.
   */
  loadSave<T extends Json = Json>(schema?: SaveSchema<T>): Promise<T | null>
  /** Écrase la sauvegarde du joueur pour ce jeu. */
  save(data: Json): Promise<void>
  clearSave(): Promise<void>
  /** Socle temps réel (salles de jeu), scopé sur ce jeu. Un jeu solo n'a pas besoin de s'en servir. */
  readonly realtime: Realtime
}

export type GameProps = { ctx: GameContext }

export interface GameDefinition {
  /** Identifiant unique, = games.slug en base et segment d'URL /games/:slug */
  slug: string
  title: string
  description: string
  thumbnail?: string
  /** Format de jeu (nombre de joueurs), = games.category en base. Voir ./categories.ts */
  category: GameCategory
  /** Genre du jeu, = games.theme en base. Voir ./themes.ts */
  theme: GameTheme
  /** Accès, indépendant de la catégorie. 'solo' : jouable sans compte (invité). 'multiplayer' : connexion obligatoire. */
  mode: GameMode
  /** Bornes d'un score valide (0 minimum). Doit rester aligné avec games.max_score en base. */
  scoreLimits?: ScoreLimits
  /** Chargé à la demande : le code du jeu n'est téléchargé qu'à l'ouverture. */
  component: LazyExoticComponent<ComponentType<GameProps>>
}
