import * as z from 'zod/mini'
import { GameError } from '../../errors'
import type { GameContext } from '../../types'
import { maxTile } from '../domain/board'
import type { GameState } from '../domain/game'

/** Sauvegarde du jeu (game_saves.data) : le meilleur score. Une sauvegarde d'un autre format est ignorée. */
const saveSchema = z.object({
  version: z.literal(1),
  best: z.number(),
})

/**
 * Fin d'une partie : envoie le score au classement, puis garde le record s'il est battu (S3 à S7).
 * Le score part avant la sauvegarde : s'il est refusé, le record n'est pas gardé. Exception : une coupure
 * réseau, où le SDK garde le score pour plus tard.
 */
export async function finishGame(ctx: GameContext, game: GameState) {
  const saved = await ctx.loadSave(saveSchema)
  const improved = game.score > (saved?.best ?? 0)
  const best = improved ? game.score : (saved?.best ?? 0)
  const saveRecord = async () => {
    if (improved) await ctx.save({ version: 1, best })
  }

  try {
    await ctx.submitScore(game.score, { maxTile: maxTile(game.grid), moves: game.moves })
  } catch (err) {
    if (err instanceof GameError && err.code === 'queued') await saveRecord()
    throw err
  }
  await saveRecord()
  return { best, improved }
}
