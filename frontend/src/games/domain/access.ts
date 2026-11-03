import type { GameMode } from '../types'

export type AccessInput = {
  gameExists: boolean
  mode: GameMode
  /** La session est encore en cours de récupération auprès du backend. */
  authLoading: boolean
  loggedIn: boolean
  profileLoaded: boolean
}

/**
 * Ce que la page de jeu doit afficher :
 * - not-found : slug inconnu ;
 * - loading : session ou profil pas encore disponible ;
 * - login : jeu à compte requis et joueur non connecté ;
 * - guest / player : le jeu se lance, en invité ou avec le joueur connecté.
 */
export type Access = 'not-found' | 'loading' | 'login' | 'guest' | 'player'

export function gameAccess({ gameExists, mode, authLoading, loggedIn, profileLoaded }: AccessInput): Access {
  if (!gameExists) return 'not-found'
  if (authLoading) return 'loading'
  if (!loggedIn) return mode === 'solo' ? 'guest' : 'login'
  return profileLoaded ? 'player' : 'loading'
}
