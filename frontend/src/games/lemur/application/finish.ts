/**
 * Fin de partie côté plateforme (EF-8) : relie le domaine de LemurTiki au GameContext du SDK.
 */
import type { GameState } from '../domain/game'
import type { GameContext } from '../../types'

/** Ce que l'écran de fin affiche : le score, et un message pour le joueur s'il y en a un. */
export type Finish = { score: number; message: string | null }

/** Envoie le score de la partie terminée ; ne rejette jamais, pour que le joueur puisse toujours rejouer. */
export async function finishGame(_state: GameState, _ctx: GameContext, _durationMs: number): Promise<Finish> {
  return { score: 0, message: null }
}
