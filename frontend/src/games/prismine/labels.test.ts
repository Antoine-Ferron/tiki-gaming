/**
 * Tests unitaires des textes affichés (labels.ts) : accords et formulations vues par le joueur.
 */
import { describe, expect, it } from 'vitest'
import { emptyGrid, withPiece } from './engine'
import { outcomeText, plural, solutionText } from './labels'

describe('plural', () => {
  it('garde le singulier pour 0 et 1, comme en français', () => {
    expect([plural(0, 'rebond'), plural(1, 'rebond'), plural(2, 'rebond')]).toEqual([
      '0 rebond',
      '1 rebond',
      '2 rebonds',
    ])
  })

  it('accepte un pluriel irrégulier', () => {
    expect(plural(3, 'cristal', 'cristaux')).toBe('3 cristaux')
  })
})

describe('outcomeText', () => {
  it('décrit la sortie et les rebonds', () => {
    expect(outcomeText({ exit: 14, bounces: 2 }, 6)).toBe('sortie Bas D après 2 rebonds')
    expect(outcomeText({ exit: 14, bounces: 0 }, 6)).toBe('sortie Bas D sans rebond')
  })

  it('décrit un faisceau absorbé', () => {
    expect(outcomeText({ exit: null, bounces: 1 }, 6)).toBe('absorbé après 1 rebond')
  })
})

describe('solutionText', () => {
  it('liste les cristaux puis les obsidiennes, avec leurs coordonnées', () => {
    let grid = withPiece(emptyGrid(6), 7, '/') // B2
    grid = withPiece(grid, 2 * 6 + 3, '\\') // D3
    grid = withPiece(grid, 35, '#') // F6
    expect(solutionText(grid, 6)).toBe('Cristaux : B2 /, D3 \\ ; obsidienne : F6.')
  })
})
