import * as z from 'zod/mini'
import type { Json } from '@/lib/database.types'
import type { GameContext } from '../types'
import { type Game, isGameOver, LOWER_CATEGORIES, newGame, totalScore, UPPER_CATEGORIES } from './logic'

const die = z.number().check(z.int(), z.gte(1), z.lte(6))
const sheet = z.partialRecord(
  z.enum([...UPPER_CATEGORIES, ...LOWER_CATEGORIES]),
  z.number().check(z.int(), z.nonnegative()),
)

/** Schéma de la sauvegarde : une sauvegarde corrompue ou d'un ancien format est ignorée (nouvelle partie). */
const saveSchema = z.object({
  sheets: z.tuple([sheet, sheet]),
  current: z.union([z.literal(0), z.literal(1)]),
  turn: z.nullable(
    z.object({
      dice: z.tuple([die, die, die, die, die]),
      kept: z.tuple([z.boolean(), z.boolean(), z.boolean(), z.boolean(), z.boolean()]),
      rollsUsed: z.number().check(z.int(), z.gte(1), z.lte(3)),
    }),
  ),
})

/** Reprend la partie sauvegardée, ou en commence une nouvelle. */
export async function loadGame(ctx: Pick<GameContext, 'loadSave'>): Promise<Game> {
  return ((await ctx.loadSave(saveSchema)) as Game | null) ?? newGame()
}

export function saveGame(ctx: Pick<GameContext, 'save'>, game: Game): Promise<void> {
  return ctx.save(game as unknown as Json)
}

/**
 * Fin de partie : envoie une seule fois le total du joueur 1 (le compte connecté ; le joueur 2 joue
 * sur le même écran sans compte) et efface la sauvegarde. Rien tant que les deux feuilles ne sont pas complètes.
 */
export async function finishGame(
  ctx: Pick<GameContext, 'submitScore' | 'clearSave'>,
  game: Game,
): Promise<number | null> {
  if (!isGameOver(game)) return null
  const total = totalScore(game.sheets[0])
  await ctx.clearSave()
  await ctx.submitScore(total)
  return total
}
