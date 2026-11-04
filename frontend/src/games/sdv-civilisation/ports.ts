import type { ActionType, GameView } from './game'
import type { Wonder } from './wonders'

/**
 * Contrats du jeu côté front. Le serveur arbitre la partie (règles, IA, minuteur, score) : le front affiche la vue
 * qu'il renvoie et lui envoie le coup choisi. Implémentation de production dans ./adapters, fake dans ./test/fakes.
 */

export type Resource = 'wood' | 'stone' | 'clay' | 'ore' | 'glass' | 'papyrus' | 'textile'

/** Serveur de partie : une partie par joueur, gardée côté serveur (session pour un invité, base pour un compte). */
export interface GameServer {
  wonders(): Promise<Wonder[]>
  /** Partie à reprendre, ou null s'il n'y en a pas. */
  current(): Promise<GameView | null>
  /** Nouvelle partie avec la merveille choisie ; remplace la partie en cours. */
  start(wonder: string): Promise<GameView>
  /** Joue la carte en position `card` de la main, sur la version de la partie que le joueur a vue. */
  play(card: number, action: ActionType, version: number): Promise<GameView>
  abandon(): Promise<void>
}

/** Coup refusé parce que la partie a avancé sans lui (minuteur expiré, autre onglet) : porte la partie à jour. */
export class TurnConflict extends Error {
  readonly game: GameView

  constructor(message: string, game: GameView) {
    super(message)
    this.name = 'TurnConflict'
    this.game = game
  }
}
