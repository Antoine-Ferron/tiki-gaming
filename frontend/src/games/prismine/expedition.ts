/**
 * Règles d'une expédition : huile de lampe, validation de la carte, score, et format de la sauvegarde.
 * Fonctions pures : le composant décide quand sauvegarder et quand envoyer le score.
 */
import {
  differingEntries,
  emptyGrid,
  entryCount,
  floorSpec,
  sameOutcome,
  trace,
  type Floor,
  type Grid,
  type Outcome,
} from './engine'

export const START_OIL = 20
export const PROBE_COST = 1
export const ERROR_COST = 3
export const FLOOR_REFILL = 10

/** Un tir du journal. `revealed` : tir offert après une validation ratée. */
export type Probe = { entry: number; revealed?: boolean }

export type ProbeResult = Probe & Outcome

/** Expédition en cours, sauvegardée telle quelle. La carte cachée est régénérée depuis `seed`. */
export type Run = {
  depth: number
  seed: number
  oil: number
  score: number
  /** Validations ratées sur l'étage en cours : la première fait perdre le bonus « sans erreur ». */
  floorErrors: number
  probes: Probe[]
  /** Carte du joueur pour l'étage en cours. */
  guess: Grid
  totalProbes: number
  totalErrors: number
}

export type Stats = { runs: number; bestDepth: number; bestScore: number }

export type Save = { version: 1; run: Run | null; stats: Stats }

export type Verdict =
  /** La carte contredit des tirs déjà faits (indices dans le journal) : rien n'est décompté. */
  | { kind: 'contradiction'; probes: number[] }
  | { kind: 'cleared'; points: number; perfect: boolean; next: Run }
  /** Carte fausse : l'entrée révélée est ajoutée au journal. */
  | { kind: 'wrong'; entry: number; next: Run }
  /** Carte fausse et plus assez d'huile pour payer l'erreur : fin de l'expédition. */
  | { kind: 'lamp-out'; run: Run }

/** Points d'un étage réussi : 100 × profondeur, +50 % sans validation ratée. */
export function floorPoints(depth: number, perfect: boolean) {
  return 100 * depth + (perfect ? 50 * depth : 0)
}

export function newRun(seed: number): Run {
  return {
    depth: 1,
    seed,
    oil: START_OIL,
    score: 0,
    floorErrors: 0,
    probes: [],
    guess: emptyGrid(floorSpec(1).size),
    totalProbes: 0,
    totalErrors: 0,
  }
}

export function probeResults(floor: Floor, probes: Probe[]): ProbeResult[] {
  return probes.map((probe) => {
    const { exit, bounces } = trace(floor.grid, floor.size, probe.entry)
    return { ...probe, exit, bounces }
  })
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

/** Le joueur tire depuis une entrée encore inconnue (à vérifier par l'appelant, comme l'huile). */
export function fire(run: Run, entry: number): Run {
  return {
    ...run,
    oil: run.oil - PROBE_COST,
    probes: [...run.probes, { entry }],
    totalProbes: run.totalProbes + 1,
  }
}

/**
 * Valide la carte du joueur. Elle est juste si chaque entrée de la galerie donne le même résultat
 * que sur la vraie carte : deux cartes indiscernables par la lumière sont donc toutes les deux justes.
 */
export function validate(run: Run, floor: Floor, nextSeed: number, random = Math.random): Verdict {
  const contradicted = probeResults(floor, run.probes).flatMap((result, index) =>
    sameOutcome(result, trace(run.guess, floor.size, result.entry)) ? [] : [index],
  )
  if (contradicted.length > 0) return { kind: 'contradiction', probes: contradicted }

  const differing = differingEntries(floor.grid, run.guess, floor.size)
  if (differing.length === 0) {
    const perfect = run.floorErrors === 0
    const points = floorPoints(run.depth, perfect)
    const depth = run.depth + 1
    const next: Run = {
      ...run,
      depth,
      seed: nextSeed,
      oil: run.oil + FLOOR_REFILL,
      score: run.score + points,
      floorErrors: 0,
      probes: [],
      guess: emptyGrid(floorSpec(depth).size),
    }
    return { kind: 'cleared', points, perfect, next }
  }

  if (run.oil < ERROR_COST) return { kind: 'lamp-out', run: { ...run, totalErrors: run.totalErrors + 1 } }
  const entry = differing[Math.floor(random() * differing.length)]
  const next: Run = {
    ...run,
    oil: run.oil - ERROR_COST,
    floorErrors: run.floorErrors + 1,
    totalErrors: run.totalErrors + 1,
    probes: [...run.probes, { entry, revealed: true }],
  }
  return { kind: 'wrong', entry, next }
}

/** Clôt l'expédition : la sauvegarde ne garde que les statistiques. */
export function endRun(save: Save, run: Run): Save {
  return {
    version: 1,
    run: null,
    stats: {
      runs: save.stats.runs + 1,
      bestDepth: Math.max(save.stats.bestDepth, run.depth),
      bestScore: Math.max(save.stats.bestScore, run.score),
    },
  }
}

// ---------------------------------------------------------------------------------------------
// Lecture de la sauvegarde : elle vient du navigateur ou de la base, on ne lui fait pas confiance.

export function parseSave(raw: unknown): Save {
  const data = isObject(raw) ? raw : {}
  return { version: 1, run: parseRun(data.run), stats: parseStats(data.stats) }
}

function parseStats(raw: unknown): Stats {
  const data = isObject(raw) ? raw : {}
  return {
    runs: isCount(data.runs) ? data.runs : 0,
    bestDepth: isCount(data.bestDepth) ? data.bestDepth : 0,
    bestScore: isCount(data.bestScore) ? data.bestScore : 0,
  }
}

function parseRun(raw: unknown): Run | null {
  if (!isObject(raw)) return null
  const counts = ['depth', 'seed', 'oil', 'score', 'floorErrors', 'totalProbes', 'totalErrors'] as const
  if (!counts.every((key) => isCount(raw[key])) || (raw.depth as number) < 1) return null
  const run = raw as Run // champs numériques vérifiés ci-dessus
  const { size } = floorSpec(run.depth)
  if (typeof run.guess !== 'string' || run.guess.length !== size * size || !/^[./\\#]*$/.test(run.guess)) {
    return null
  }
  if (!Array.isArray(run.probes)) return null
  const probes: Probe[] = []
  for (const probe of run.probes as unknown[]) {
    if (!isObject(probe) || !isCount(probe.entry) || probe.entry >= entryCount(size)) return null
    probes.push(probe.revealed === true ? { entry: probe.entry, revealed: true } : { entry: probe.entry })
  }
  return {
    depth: run.depth,
    seed: run.seed,
    oil: run.oil,
    score: run.score,
    floorErrors: run.floorErrors,
    probes,
    guess: run.guess,
    totalProbes: run.totalProbes,
    totalErrors: run.totalErrors,
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isCount(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0
}
