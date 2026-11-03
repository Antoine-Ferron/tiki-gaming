import { describe, expect, test } from 'vitest'
import { parseBoard } from './board'
import { isSolved, moveVehicle } from './moves'
import { solve } from './solver'

const E = '......'

describe('solve : la solution la plus courte (R8)', () => {
  test('un plateau déjà gagné se résout en 0 coup', () => {
    // Arrange
    const board = parseBoard([E, E, '....XX', E, E, E])

    // Act
    const solution = solve(board)

    // Assert
    expect(solution).toEqual([])
  })

  test('une voiture libre sort en 1 coup, d’un seul glissement', () => {
    // Arrange
    const board = parseBoard([E, E, 'XX....', E, E, E])

    // Act
    const solution = solve(board)

    // Assert
    expect(solution).toEqual([{ id: 'X', delta: 4 }])
  })

  test('trouve la solution la plus courte quand un véhicule bloque, et elle mène à la victoire', () => {
    // Arrange
    const board = parseBoard([E, '....A.', 'XX..A.', E, E, E])

    // Act
    const solution = solve(board)

    // Assert
    expect(solution).toHaveLength(2)
    const end = solution!.reduce((b, m) => moveVehicle(b, m.id, m.delta), board)
    expect(isSolved(end)).toBe(true)
  })

  test('un plateau impossible n’a pas de solution', () => {
    // Arrange : un véhicule horizontal sur la ligne de sortie, devant la voiture rouge
    const board = parseBoard([E, E, 'XX.AA.', E, E, E])

    // Act
    const solution = solve(board)

    // Assert
    expect(solution).toBeNull()
  })
})
