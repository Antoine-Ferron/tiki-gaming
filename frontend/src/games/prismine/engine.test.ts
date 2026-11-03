/**
 * Tests unitaires du moteur (engine.ts) : trajet des faisceaux et génération des étages.
 * Fonctions pures, aucune doublure nécessaire. Les tests de propriétés rejouent 400 étages
 * générés avec des graines fixes : un échec est toujours reproductible.
 */
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
} from './engine'

const SAMPLES = Array.from({ length: 400 }, (_, i) => generateFloor(1 + (i % 8), (i * 2654435761) >>> 0))

/** Galerie 6 × 6 avec une seule pièce en D3 (ligne 2, colonne 3 en partant de 0). */
function oneCell(piece: '/' | '\\' | '#') {
  return withPiece(emptyGrid(6), 2 * 6 + 3, piece)
}

function exitName(grid: string, entry: number) {
  const { exit } = trace(grid, 6, entry)
  return exit === null ? null : entryName(exit, 6)
}

describe('entrées', () => {
  it('sont numérotées dans le sens horaire et nommées par leur repère', () => {
    expect([0, 6, 12, 23].map((entry) => entryName(entry, 6))).toEqual(['Haut A', 'Droite 1', 'Bas F', 'Gauche 1'])
  })

  it('se retrouvent à partir de leur position sur le bord', () => {
    for (const size of [6, 7, 8]) {
      for (let entry = 0; entry < entryCount(size); entry++) {
        const { row, col } = entryStart(entry, size)
        expect(entryAt(row, col, size)).toBe(entry)
      }
    }
  })
})

describe('faisceau', () => {
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

  it("est absorbé par l'obsidienne, et son tracé s'arrête dessus", () => {
    const result = trace(oneCell('#'), 6, 3)
    expect(result.exit).toBeNull()
    expect(result.path.at(-1)).toEqual([2, 3])
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
  it('dépendent seulement de la profondeur et de la graine, avec les pièces prévues', () => {
    for (const floor of SAMPLES) {
      const spec = floorSpec(floor.depth)
      expect(generateFloor(floor.depth, floor.seed).grid).toBe(floor.grid)
      expect(floor.grid).toHaveLength(spec.size * spec.size)
      expect([...floor.grid].filter((p) => p === '/' || p === '\\')).toHaveLength(spec.crystals)
      expect([...floor.grid].filter((p) => p === '#')).toHaveLength(spec.obsidians)
    }
  })

  it('plafonnent la difficulté après le dernier palier', () => {
    expect(floorSpec(50)).toEqual(floorSpec(8))
  })

  it('ne cachent que des pièces touchées par au moins un faisceau', () => {
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
})

describe('pose des pièces', () => {
  it("fait tourner les pièces au clic, l'obsidienne seulement si l'étage en cache", () => {
    expect([nextPiece('.', false), nextPiece('/', false), nextPiece('\\', false)]).toEqual(['/', '\\', '.'])
    expect([nextPiece('\\', true), nextPiece('#', true)]).toEqual(['#', '.'])
  })

  it('tourne dans l’autre sens au clic droit', () => {
    expect(nextPiece('.', true, true)).toBe('#')
    expect(nextPiece('/', false, true)).toBe('.')
  })
})
