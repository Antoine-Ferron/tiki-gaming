import { describe, expect, test } from 'vitest'
import { parseBoard } from './board'
import { moveRange } from './moves'

const E = '......'

describe('moveRange : jusqu’où un véhicule peut glisser (R4, R5)', () => {
  // Valeurs limites sur les bords : la voiture s'arrête contre le bord, jamais au-delà
  test.each([
    { row: '.XX...', expected: { min: -1, max: 3 }, name: 'seule sur sa ligne' },
    { row: 'XX....', expected: { min: 0, max: 4 }, name: 'collée au bord gauche' },
    { row: '....XX', expected: { min: -4, max: 0 }, name: 'collée au bord droit' },
  ])('voiture rouge $name → $expected', ({ row, expected }) => {
    // Arrange
    const board = parseBoard([E, E, row, E, E, E])

    // Act
    const range = moveRange(board, 'X')

    // Assert
    expect(range).toEqual(expected)
  })

  test('un véhicule plus loin arrête la voiture juste avant lui', () => {
    // Arrange : camion A vertical en colonne 5, la voiture rouge peut avancer de 3 cases
    const board = parseBoard([E, '.....A', 'XX...A', '.....A', E, E])

    // Act
    const range = moveRange(board, 'X')

    // Assert
    expect(range).toEqual({ min: 0, max: 3 })
  })

  test('un véhicule collé bloque complètement ce côté', () => {
    // Arrange
    const board = parseBoard([E, '..A...', 'XXA...', E, E, E])

    // Act
    const range = moveRange(board, 'X')

    // Assert
    expect(range).toEqual({ min: 0, max: 0 })
  })

  test('un véhicule vertical glisse vers le haut (négatif) et le bas (positif)', () => {
    // Arrange : camion C en colonne 6, lignes 3 à 5 ; 2 cases libres au-dessus, 1 en dessous
    const board = parseBoard([E, E, 'XX...C', '.....C', '.....C', E])

    // Act
    const range = moveRange(board, 'C')

    // Assert
    expect(range).toEqual({ min: -2, max: 1 })
  })

  test('un véhicule sur une autre ligne ne bloque pas', () => {
    // Arrange
    const board = parseBoard(['AA....', E, 'XX....', E, E, E])

    // Act
    const range = moveRange(board, 'X')

    // Assert
    expect(range).toEqual({ min: 0, max: 4 })
  })

  test('refuse un véhicule inconnu', () => {
    // Arrange
    const board = parseBoard([E, E, 'XX....', E, E, E])

    // Act
    const range = () => moveRange(board, 'Z')

    // Assert
    expect(range).toThrow('Véhicule inconnu : Z')
  })
})
