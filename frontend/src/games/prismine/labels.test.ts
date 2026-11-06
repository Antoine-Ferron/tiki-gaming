/**
 * TU — textes affichés au joueur (labels.ts) : couleurs, résultats de tir et solution lue aux lecteurs d'écran.
 */
import { describe, expect, it } from 'vitest'
import { BLUE, GREEN, NW, RED, SE, emptyGrid, prism, withPiece } from './engine'
import { lightName, outcomeText, solutionText } from './labels'

describe('textes', () => {
  it('nomment les couleurs, décrivent un tir et listent la solution', () => {
    expect([0, RED | GREEN, RED | GREEN | BLUE].map(lightName)).toEqual(['blanc', 'jaune', 'irisé'])
    expect(outcomeText({ exit: 14, bounces: 2, color: RED | GREEN }, 6)).toBe('sortie Bas D, jaune, après 2 rebonds')
    expect(outcomeText({ exit: null, bounces: 0, color: 0 }, 6)).toBe('absorbé, blanc, sans rebond')

    let grid = withPiece(emptyGrid(6), 7, prism(RED, SE)) // B2
    grid = withPiece(grid, 2 * 6 + 3, prism(GREEN, NW)) // D3
    grid = withPiece(grid, 35, '#') // F6
    expect(solutionText(grid, 6)).toBe(
      'Prismes : B2 rouge, angle en bas à droite ; D3 vert, angle en haut à gauche. Obsidienne : F6.',
    )
  })
})
