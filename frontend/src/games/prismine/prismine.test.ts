import { describe, expect, it } from 'vitest'
import {
  emptyGrid,
  entryAt,
  entryCount,
  entryName,
  entryStart,
  floorSpec,
  generateFloor,
  nextPiece,
  trace,
  withPiece,
  type Floor,
} from './engine'
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

/** Étages générés pour les tests de propriétés : graines fixes, résultats reproductibles. */
const SAMPLES = Array.from({ length: 400 }, (_, i) => generateFloor(1 + (i % 8), (i * 2654435761) >>> 0))

/** Galerie 6 × 6 avec une seule pièce en D3 (ligne 2, colonne 3 en partant de 0). */
function oneCell(piece: '/' | '\\' | '#') {
  return withPiece(emptyGrid(6), 2 * 6 + 3, piece)
}

function testFloor(grid: string): Floor {
  return { size: 6, crystals: 0, obsidians: 0, depth: 1, seed: 1, grid }
}

function exitName(grid: string, entry: number) {
  const { exit } = trace(grid, 6, entry)
  return exit === null ? null : entryName(exit, 6)
}

describe('faisceaux', () => {
  it('numérote les entrées dans le sens horaire et les nomme par leur repère', () => {
    expect([0, 6, 12, 23].map((entry) => entryName(entry, 6))).toEqual(['Haut A', 'Droite 1', 'Bas F', 'Gauche 1'])
    for (const size of [6, 7, 8]) {
      for (let entry = 0; entry < entryCount(size); entry++) {
        const { row, col } = entryStart(entry, size)
        expect(entryAt(row, col, size)).toBe(entry)
      }
    }
  })

  it('traverse une galerie vide en ligne droite, sans rebond', () => {
    expect(exitName(emptyGrid(6), 2)).toBe('Bas C')
    expect(trace(emptyGrid(6), 6, 2).bounces).toBe(0)
  })

  it("est dévié d'un quart de tour par un cristal « / » ou « \\ »", () => {
    // Depuis Haut D, le faisceau descend et rencontre la pièce en D3.
    expect(exitName(oneCell('/'), 3)).toBe('Gauche 3')
    expect(exitName(oneCell('\\'), 3)).toBe('Droite 3')
    expect(trace(oneCell('/'), 6, 3).bounces).toBe(1)
    // Depuis Droite 3, le faisceau va vers l'ouest : « / » le renvoie vers le sud.
    expect(exitName(oneCell('/'), 8)).toBe('Bas D')
  })

  it("est absorbé par l'obsidienne", () => {
    const result = trace(oneCell('#'), 6, 3)
    expect(result.exit).toBeNull()
    expect(result.path[result.path.length - 1]).toEqual([2, 3])
  })

  it('suit un trajet réversible qui ne ressort jamais par son entrée', () => {
    for (const floor of SAMPLES) {
      for (let entry = 0; entry < entryCount(floor.size); entry++) {
        const there = trace(floor.grid, floor.size, entry)
        if (there.exit === null) continue
        expect(there.exit).not.toBe(entry)
        const back = trace(floor.grid, floor.size, there.exit)
        expect([back.exit, back.bounces]).toEqual([entry, there.bounces])
      }
    }
  })
})

describe('étages', () => {
  it('dépendent seulement de leur profondeur et de leur graine, avec les pièces prévues', () => {
    for (const floor of SAMPLES) {
      const spec = floorSpec(floor.depth)
      expect(generateFloor(floor.depth, floor.seed).grid).toBe(floor.grid)
      expect(floor.grid).toHaveLength(spec.size * spec.size)
      expect([...floor.grid].filter((p) => p === '/' || p === '\\')).toHaveLength(spec.crystals)
      expect([...floor.grid].filter((p) => p === '#')).toHaveLength(spec.obsidians)
    }
  })

  it('cachent uniquement des pièces touchées par au moins un faisceau', () => {
    for (const floor of SAMPLES) {
      const touched = new Set<number>()
      for (let entry = 0; entry < entryCount(floor.size); entry++) {
        for (const [row, col] of trace(floor.grid, floor.size, entry).path) {
          if (row >= 0 && col >= 0 && row < floor.size && col < floor.size) touched.add(row * floor.size + col)
        }
      }
      for (let cell = 0; cell < floor.grid.length; cell++) {
        if (floor.grid[cell] !== '.') expect(touched.has(cell)).toBe(true)
      }
    }
  })

  it("font tourner les pièces au clic, l'obsidienne seulement si l'étage en cache", () => {
    expect([nextPiece('.', false), nextPiece('/', false), nextPiece('\\', false)]).toEqual(['/', '\\', '.'])
    expect([nextPiece('\\', true), nextPiece('#', true)]).toEqual(['#', '.'])
    expect(nextPiece('.', true, true)).toBe('#')
  })
})

describe('expédition', () => {
  it("fait payer un tir d'une dose d'huile et fait connaître son entrée et sa sortie", () => {
    const run = fire(newRun(1), 3)
    expect(run.oil).toBe(START_OIL - 1)
    const known = knownEntries(probeResults(testFloor(oneCell('/')), run.probes))
    expect(known.get(3)).toBe(0)
    expect(known.get(entryAt(2, -1, 6))).toBe(0)
  })

  it("fait descendre d'un étage avec les points et l'huile quand la carte est juste", () => {
    const floor = generateFloor(1, 1)
    const verdict = validate({ ...newRun(1), guess: floor.grid }, floor, 99)
    expect(verdict).toMatchObject({
      kind: 'cleared',
      points: floorPoints(1, true),
      next: { depth: 2, seed: 99, oil: START_OIL + FLOOR_REFILL, guess: emptyGrid(floorSpec(2).size) },
    })
  })

  it('accepte une carte indiscernable de la vraie par la lumière', () => {
    // Quatre obsidiennes entourent C3 : aucun faisceau ne peut y entrer, un cristal posé là ne change rien.
    let truth = emptyGrid(6)
    for (const cell of [1 * 6 + 2, 3 * 6 + 2, 2 * 6 + 1, 2 * 6 + 3]) truth = withPiece(truth, cell, '#')
    const guess = withPiece(truth, 2 * 6 + 2, '/')
    expect(validate({ ...newRun(1), guess }, testFloor(truth), 99).kind).toBe('cleared')
  })

  it('refuse sans rien coûter une carte qui contredit un tir', () => {
    const run = fire(newRun(1), 3)
    expect(validate(run, testFloor(oneCell('/')), 99)).toEqual({ kind: 'contradiction', probes: [0] })
  })

  it('fait payer une carte fausse, révèle un tir et retire le bonus sans erreur', () => {
    const floor = testFloor(oneCell('/'))
    const verdict = validate(newRun(1), floor, 99, () => 0)
    if (verdict.kind !== 'wrong') throw new Error(`verdict ${verdict.kind}`)
    expect(verdict.next.oil).toBe(START_OIL - ERROR_COST)
    expect(verdict.next.probes).toEqual([{ entry: verdict.entry, revealed: true }])
    const retry = validate({ ...verdict.next, guess: floor.grid }, floor, 99)
    expect(retry).toMatchObject({ kind: 'cleared', points: floorPoints(1, false) })
  })

  it("éteint la lampe s'il ne reste pas assez d'huile pour payer une erreur", () => {
    const verdict = validate({ ...newRun(1), oil: ERROR_COST - 1 }, testFloor(oneCell('/')), 99)
    expect(verdict.kind).toBe('lamp-out')
  })

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
    const raw = JSON.parse(
      JSON.stringify({ version: 1, run: { ...run, extra: true }, stats: { runs: 2, bestDepth: 4, bestScore: 900 } }),
    )
    expect(parseSave(raw)).toEqual({ version: 1, run, stats: { runs: 2, bestDepth: 4, bestScore: 900 } })
  })

  it("ne garde que les statistiques en fin d'expédition", () => {
    const save = parseSave({ version: 1, run: newRun(7), stats: { runs: 2, bestDepth: 4, bestScore: 900 } })
    expect(endRun(save, { ...newRun(7), depth: 5, score: 1000 })).toEqual({
      version: 1,
      run: null,
      stats: { runs: 3, bestDepth: 5, bestScore: 1000 },
    })
  })
})
