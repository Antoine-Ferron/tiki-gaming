/**
 * Fin de partie côté plateforme (EF-8) : relie le domaine de LemurTiki au GameContext du SDK.
 */
import { toGameError } from '../../errors'
import type { GameContext } from '../../types'
import { type GameState, PX_PER_METER } from '../domain/game'
import { score } from '../domain/score'

/** Ce que l'écran de fin affiche : le score, et un message pour le joueur s'il y en a un. */
export type Finish = { score: number; message: string | null }

const GUEST_MESSAGE = 'Connecte-toi pour apparaître au classement.'

/** Envoie le score de la partie terminée ; ne rejette jamais, pour que le joueur puisse toujours rejouer. */
export async function finishGame(state: GameState, ctx: GameContext, durationMs: number): Promise<Finish> {
  const points = score(state)
  const metadata = {
    heightMeters: Math.floor(state.peakY / PX_PER_METER),
    vanilla: state.vanilla,
    cause: state.over,
    durationMs,
  }
  try {
    const recorded = await ctx.submitScore(points, metadata)
    return { score: points, message: recorded ? null : GUEST_MESSAGE }
  } catch (err) {
    return { score: points, message: toGameError(err).message }
  }
}
