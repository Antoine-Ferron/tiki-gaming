import * as z from 'zod/mini'
import type { GameContext } from '../../types'
import type { BestScores } from '../domain/progress'

/** Sauvegarde du jeu (game_saves.data) : les records par niveau. Une sauvegarde d'un autre format est ignorée. */
export const saveSchema = z.object({
  version: z.literal(1),
  best: z.record(z.string(), z.number()),
})

/** Records du joueur par niveau (vide s'il n'a encore rien terminé ou si la sauvegarde est illisible). */
export async function loadBest(ctx: GameContext): Promise<BestScores> {
  return (await ctx.loadSave(saveSchema))?.best ?? {}
}
