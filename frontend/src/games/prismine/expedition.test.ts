/**
 * Tests unitaires des règles d'expédition (expedition.ts) : huile, validation, score, sauvegarde.
 * Les étages sont construits à la main (une pièce bien placée) pour que chaque règle soit lisible ;
 * le hasard de `validate` (choix du tir révélé) est remplacé par un bouchon `() => 0`.
 */
import { describe, expect, it } from 'vitest'
import { emptyGrid, entryAt, floorSpec, generateFloor, withPiece, type Floor } from './engine'
import {
  ERROR_COST,
  FLOOR_REFILL,
  START_OIL,
  endRun,
  fire,
  floorPoints,
  knownEntries,
  newRun,
  parseSave,
  probeResults,
  validate,
} from './expedition'

/** Étage 6 × 6 dont la seule pièce est un « / » en D3 : depuis Haut D, le faisceau sort en Gauche 3. */
const ONE_MIRROR: Floor = {
  size: 6,
  crystals: 1,
  obsidians: 0,
  depth: 1,
  seed: 1,
  grid: withPiece(emptyGrid(6), 2 * 6 + 3, '/'),
}
const HAUT_D = 3

describe('tirs', () => {
  it("coûtent une dose d'huile et font connaître l'entrée et la sortie", () => {
    const run = fire(newRun(1), HAUT_D)
    expect(run.oil).toBe(START_OIL - 1)
    expect(run.totalProbes).toBe(1)
    const known = knownEntries(probeResults(ONE_MIRROR, run.probes))
    expect(known.get(HAUT_D)).toBe(0)
    expect(known.get(entryAt(2, -1, 6))).toBe(0) // Gauche 3
  })
})

describe('validation de la carte', () => {
  it("fait descendre d'un étage avec les points et l'huile quand la carte est juste", () => {
    const floor = generateFloor(1, 1)
    expect(validate({ ...newRun(1), guess: floor.grid }, floor, 99)).toMatchObject({
      kind: 'cleared',
      points: floorPoints(1, true),
      perfect: true,
      next: { depth: 2, seed: 99, oil: START_OIL + FLOOR_REFILL, probes: [], guess: emptyGrid(floorSpec(2).size) },
    })
  })

  it('accepte une carte indiscernable de la vraie par la lumière', () => {
    // Quatre obsidiennes entourent C3 : aucun faisceau ne peut y entrer, un cristal posé là ne change rien.
    let truth = emptyGrid(6)
    for (const cell of [1 * 6 + 2, 3 * 6 + 2, 2 * 6 + 1, 2 * 6 + 3]) truth = withPiece(truth, cell, '#')
    const guess = withPiece(truth, 2 * 6 + 2, '/')
    expect(validate({ ...newRun(1), guess }, { ...ONE_MIRROR, grid: truth }, 99).kind).toBe('cleared')
  })

  it('refuse sans rien coûter une carte qui contredit un tir déjà fait', () => {
    const run = fire(newRun(1), HAUT_D)
    expect(validate(run, ONE_MIRROR, 99)).toEqual({ kind: 'contradiction', probes: [0] })
  })

  it('fait payer une carte fausse, révèle un tir et retire le bonus sans erreur', () => {
    const verdict = validate(newRun(1), ONE_MIRROR, 99, () => 0)
    if (verdict.kind !== 'wrong') throw new Error(`verdict inattendu : ${verdict.kind}`)
    expect(verdict.next.oil).toBe(START_OIL - ERROR_COST)
    expect(verdict.next.probes).toEqual([{ entry: verdict.entry, revealed: true }])
    expect(verdict.next.floorErrors).toBe(1)

    const retry = validate({ ...verdict.next, guess: ONE_MIRROR.grid }, ONE_MIRROR, 99)
    expect(retry).toMatchObject({ kind: 'cleared', perfect: false, points: floorPoints(1, false) })
  })

  it("éteint la lampe s'il ne reste pas assez d'huile pour payer une erreur", () => {
    const verdict = validate({ ...newRun(1), oil: ERROR_COST - 1 }, ONE_MIRROR, 99)
    expect(verdict).toMatchObject({ kind: 'lamp-out', run: { totalErrors: 1 } })
  })
})

describe('score', () => {
  it('rapporte 100 points × la profondeur, +50 % sans erreur', () => {
    expect([floorPoints(1, true), floorPoints(3, false), floorPoints(4, true)]).toEqual([150, 300, 600])
  })
})

describe('sauvegarde', () => {
  it.each([
    null,
    42,
    'texte',
    [],
    { run: 3 },
    { run: { ...newRun(1), depth: 0 } },
    { run: { ...newRun(1), guess: 'abc' } },
    { run: { ...newRun(1), probes: [{ entry: 999 }] } },
    { stats: { runs: -1, bestDepth: 1.5, bestScore: 'beaucoup' } },
  ])('ignore une sauvegarde illisible ou incohérente : %j', (raw) => {
    expect(parseSave(raw)).toEqual({ version: 1, run: null, stats: { runs: 0, bestDepth: 0, bestScore: 0 } })
  })

  it("relit une sauvegarde valide à l'identique, sans les champs inconnus", () => {
    const run = fire(newRun(7), 3)
    const stats = { runs: 2, bestDepth: 4, bestScore: 900 }
    const raw = JSON.parse(JSON.stringify({ version: 1, run: { ...run, extra: true }, stats }))
    expect(parseSave(raw)).toEqual({ version: 1, run, stats })
  })

  it("ne garde que les statistiques en fin d'expédition, sans faire baisser le record", () => {
    const save = parseSave({ version: 1, run: newRun(7), stats: { runs: 2, bestDepth: 4, bestScore: 900 } })
    expect(endRun(save, { ...newRun(7), depth: 5, score: 600 })).toEqual({
      version: 1,
      run: null,
      stats: { runs: 3, bestDepth: 5, bestScore: 900 },
    })
  })
})
