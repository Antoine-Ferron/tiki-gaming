import { GameError } from '../../errors'
import type { GameContext } from '../../types'
import { scoreToSubmit, type MiniGtaSave } from '../domain/save'
import type { ProgressSession } from './gameStore'

/**
 * Persistance de la progression par le GameContext : sauvegarde (`ctx.save`), puis envoi de l'argent gagné
 * (`ctx.submitScore`) s'il bat le dernier score envoyé. Les deux sont indépendants : l'échec de l'un est
 * signalé au joueur sans empêcher l'autre.
 */
export function createProgressSession(
  ctx: Pick<GameContext, 'save' | 'submitScore' | 'isGuest'>,
  best: number | null,
  notify: (message: string) => void,
): ProgressSession {
  let lastSent = best
  return {
    async persist(progress: MiniGtaSave) {
      try {
        await ctx.save(progress)
      } catch (e) {
        notify((e as Error).message)
      }
      const score = scoreToSubmit(progress.totalEarned, lastSent)
      if (score === null || ctx.isGuest) return
      try {
        await ctx.submitScore(score, { missions: progress.completedMissions.length })
        lastSent = score
      } catch (e) {
        // Coupure réseau : la plateforme garde le score et le renverra elle-même.
        if (e instanceof GameError && e.code === 'queued') lastSent = score
        notify((e as Error).message)
      }
    },
  }
}
