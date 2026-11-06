/**
 * Ce que le navigateur garde d'une expédition : son identifiant sur le serveur, la carte en cours du joueur et
 * ses statistiques. Les règles (huile, validation, score) sont appliquées par le serveur Java : les constantes
 * ci-dessous ne servent qu'aux textes affichés et sont alignées sur Expedition.java.
 */
import type { ProbeResult, RunView } from './api'
import { GRID_PATTERN, emptyGrid, type Grid } from './engine'

export const PROBE_COST = 1
export const ERROR_COST = 3
export const FLOOR_REFILL = 10

export type Stats = { runs: number; bestDepth: number; bestScore: number }

/** `runId` : expédition en cours sur le serveur. `guess` : carte du joueur pour l'étage en cours. */
export type Save = { version: 2; runId: string | null; guess: Grid; stats: Stats }

export function emptySave(): Save {
  return { version: 2, runId: null, guess: '', stats: { runs: 0, bestDepth: 0, bestScore: 0 } }
}

/** Entrées déjà connues (départ ou sortie d'un tir) → indice du tir dans le journal. */
export function knownEntries(results: ProbeResult[]): Map<number, number> {
  const known = new Map<number, number>()
  results.forEach((result, index) => {
    known.set(result.entry, index)
    if (result.exit !== null) known.set(result.exit, index)
  })
  return known
}

/** Carte du joueur pour l'étage en cours : celle sauvegardée si elle a la bonne taille, sinon une carte vide. */
export function guessFor(save: Save, run: RunView): Grid {
  return save.guess.length === run.size * run.size ? save.guess : emptyGrid(run.size)
}

/** Clôt l'expédition : la sauvegarde ne garde que les statistiques. */
export function endStats(save: Save, run: RunView): Save {
  return {
    ...emptySave(),
    stats: {
      runs: save.stats.runs + 1,
      bestDepth: Math.max(save.stats.bestDepth, run.depth),
      bestScore: Math.max(save.stats.bestScore, run.score),
    },
  }
}

// ---------------------------------------------------------------------------------------------
// Lecture de la sauvegarde : elle vient du navigateur ou de la base, on ne lui fait pas confiance.

/**
 * Une sauvegarde d'avant le serveur arbitre (version 1) contenait l'expédition entière : le serveur ne peut pas la
 * reprendre, seules les statistiques sont gardées.
 */
export function parseSave(raw: unknown): Save {
  const data = isObject(raw) ? raw : {}
  const save = emptySave()
  save.stats = parseStats(data.stats)
  if (data.version === 2 && typeof data.runId === 'string' && data.runId.length > 0) {
    save.runId = data.runId
    if (typeof data.guess === 'string' && GRID_PATTERN.test(data.guess)) save.guess = data.guess
  }
  return save
}

function parseStats(raw: unknown): Stats {
  const data = isObject(raw) ? raw : {}
  return {
    runs: isCount(data.runs) ? data.runs : 0,
    bestDepth: isCount(data.bestDepth) ? data.bestDepth : 0,
    bestScore: isCount(data.bestScore) ? data.bestScore : 0,
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isCount(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0
}
