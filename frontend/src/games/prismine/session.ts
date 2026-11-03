/**
 * Échanges de Prismine avec la plateforme via le GameContext : sauvegarde, reprise, envoi du score.
 * Chaque fonction ne demande que la partie du ctx dont elle a besoin (`Pick<GameContext, …>`) :
 * les tests lui passent un bouchon minimal au lieu du vrai SDK (voir session.test.ts).
 */
import type { GameContext } from '../types'
import { parseSave, type Run, type Save } from './expedition'

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
 * Envoie le score d'une expédition terminée. Rien n'est envoyé sans étage réussi (score nul).
 * Renvoie true si le score est classé (false en invité ou sans score).
 */
export async function submitRunScore(ctx: Pick<GameContext, 'submitScore'>, run: Run): Promise<boolean> {
  if (run.score <= 0) return false
  return ctx.submitScore(run.score, { depth: run.depth, probes: run.totalProbes, errors: run.totalErrors })
}
