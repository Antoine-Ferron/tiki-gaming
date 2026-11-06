/**
 * Échanges de Prismine avec la plateforme (GameContext : sauvegarde, reprise) et avec le serveur arbitre.
 * Chaque fonction ne demande que la partie du ctx dont elle a besoin (`Pick<GameContext, …>`) :
 * les tests lui passent un bouchon minimal au lieu du vrai SDK (voir session.test.ts).
 */
import { ApiError } from '@/lib/api'
import type { GameContext } from '../types'
import type { PrismineApi, RunView } from './api'
import { parseSave, type Save } from './expedition'

/**
 * Écrit les sauvegardes l'une après l'autre ; pendant une écriture, seule la plus récente attend.
 * Évite qu'une ancienne sauvegarde, arrivée en retard, écrase une plus récente.
 */
export function createSaver(ctx: Pick<GameContext, 'save'>, onError: () => void) {
  let pending: Save | null = null
  let writing = false
  return async (data: Save) => {
    pending = data
    if (writing) return
    writing = true
    while (pending) {
      const next: Save = pending
      pending = null
      try {
        await ctx.save(next)
      } catch {
        onError()
      }
    }
    writing = false
  }
}

/** Charge la sauvegarde du joueur ; une sauvegarde absente ou abîmée donne une sauvegarde vierge. */
export async function loadExpedition(ctx: Pick<GameContext, 'loadSave'>): Promise<Save> {
  return parseSave(await ctx.loadSave())
}

/**
 * Reprend l'expédition sauvegardée auprès du serveur. null : pas d'expédition, ou le serveur ne la connaît plus
 * (terminée, ou d'un autre compte). Une autre erreur remonte pour que l'écran propose de réessayer.
 */
export async function resumeRun(api: Pick<PrismineApi, 'getRun'>, save: Save): Promise<RunView | null> {
  if (!save.runId) return null
  try {
    return await api.getRun(save.runId)
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null
    throw err
  }
}
