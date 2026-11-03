import type { Json } from '@/lib/database.types'
import { logger } from '@/lib/logger'
import { toGameError } from './errors'
import type { KeyValueStorage } from './ports'

export type PendingScore = { gameSlug: string; score: number; metadata: Json; attempts: number }

/** Nombre d'envois (le premier compris) au-delà duquel un score en attente est abandonné. */
export const MAX_ATTEMPTS = 5

function isPending(value: unknown): value is PendingScore {
  const v = value as Partial<PendingScore> | null | undefined
  return typeof v?.gameSlug === 'string' && Number.isInteger(v.score) && Number.isInteger(v.attempts)
}

/**
 * Scores dont l'envoi a échoué pour une raison passagère (réseau), gardés sur l'appareil du joueur
 * et renvoyés au prochain `flush`. Une erreur définitive (refus RLS, score invalide) les abandonne.
 */
export function createScoreQueue(storage: KeyValueStorage, key: string) {
  function read(): PendingScore[] {
    try {
      // Stryker disable next-line StringLiteral: '' fait lever JSON.parse, rattrapé plus bas : même résultat
      const list: unknown = JSON.parse(storage.getItem(key) ?? '[]')
      return Array.isArray(list) ? list.filter(isPending) : []
    } catch {
      return []
    }
  }

  function write(list: PendingScore[]) {
    try {
      if (list.length) storage.setItem(key, JSON.stringify(list))
      else storage.removeItem(key)
    } catch {
      // stockage indisponible : les scores en attente sont perdus, la partie continue
    }
  }

  let flushing: Promise<void> | null = null

  async function sendAll(send: (pending: PendingScore) => Promise<void>) {
    const snapshot = read()
    const kept: PendingScore[] = []
    for (const pending of snapshot) {
      try {
        await send(pending)
      } catch (err) {
        const attempts = pending.attempts + 1
        const retry = toGameError(err).retryable && attempts < MAX_ATTEMPTS
        if (retry) kept.push({ ...pending, attempts })
        // Stryker disable next-line all: journalisation seule, sans effet sur la file
        if (!retry) logger.warn({ err, pending }, 'Score en attente abandonné')
      }
    }
    // Les scores ajoutés pendant l'envoi sont à la fin de la liste : on les garde.
    write([...kept, ...read().slice(snapshot.length)])
  }

  return {
    pending: read,

    add(pending: Omit<PendingScore, 'attempts'>) {
      write([...read(), { ...pending, attempts: 1 }])
    },

    /** Renvoie les scores en attente ; deux appels simultanés partagent le même envoi. */
    flush(send: (pending: PendingScore) => Promise<void>): Promise<void> {
      flushing ??= sendAll(send).finally(() => {
        flushing = null
      })
      return flushing
    },
  }
}

export type ScoreQueue = ReturnType<typeof createScoreQueue>
