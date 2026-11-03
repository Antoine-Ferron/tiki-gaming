import type { GameContext } from '../types'
import { isSheetComplete, type Sheet, totalScore } from './logic'

/** Fin de partie : envoie le total une seule fois. Rien tant que la feuille n'est pas complète. */
export async function finishGame(ctx: GameContext, sheet: Sheet): Promise<number | null> {
  if (!isSheetComplete(sheet)) return null
  const total = totalScore(sheet)
  await ctx.submitScore(total)
  return total
}
