import * as z from 'zod/mini'
import type { GameContext } from '../../types'
import type { Difficulty } from '../domain/difficulty'
import type { BestScores } from '../domain/progress'

/** Statistiques du mode Génération pour une difficulté : plateaux réussis et meilleur score. */
export type GeneratedStats = { won: number; best: number }

/** Progression sauvegardée : records des niveaux et statistiques du mode Génération (hors classement). */
export interface Progress {
  best: BestScores
  generated?: Partial<Record<Difficulty, GeneratedStats>>
}

/** Sauvegarde du jeu (game_saves.data). Une sauvegarde d'un autre format est ignorée. */
const saveSchema = z.object({
  version: z.literal(1),
  best: z.record(z.string(), z.number()),
  generated: z.optional(z.record(z.string(), z.object({ won: z.number(), best: z.number() }))),
})

/** Progression du joueur (vide s'il n'a encore rien terminé ou si la sauvegarde est illisible). */
export async function loadProgress(ctx: GameContext): Promise<Progress> {
  const saved = await ctx.loadSave(saveSchema)
  return { best: saved?.best ?? {}, ...(saved?.generated && { generated: saved.generated }) }
}

/** Écrase la sauvegarde avec la progression complète (aucune partie n'est perdue). */
export function saveProgress(ctx: GameContext, progress: Progress): Promise<void> {
  return ctx.save({ version: 1, ...progress })
}
