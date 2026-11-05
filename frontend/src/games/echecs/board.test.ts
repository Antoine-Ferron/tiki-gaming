import { describe, expect, test } from 'vitest'
import { piecesFromFen } from './board'

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

describe('lecture de la FEN pour l’affichage', () => {
  test('la position de départ place 32 pièces : rois en e1 / e8, pions en rangées 2 et 7, centre vide', () => {
    const pieces = piecesFromFen(START)

    expect(Object.keys(pieces)).toHaveLength(32)
    expect(pieces.e1).toBe('K')
    expect(pieces.e8).toBe('k')
    expect(pieces.a2).toBe('P')
    expect(pieces.h7).toBe('p')
    expect(pieces.e4).toBeUndefined()
  })
})
