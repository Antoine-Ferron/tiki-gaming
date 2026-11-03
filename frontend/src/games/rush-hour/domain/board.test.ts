import { describe, expect, test } from 'vitest'
import { parseBoard } from './board'

describe('parseBoard', () => {
  test('lit la voiture rouge : horizontale, ligne 3, 2 cases', () => {
    // Arrange
    const map = ['......', '......', '..XX..', '......', '......', '......']

    // Act
    const board = parseBoard(map)

    // Assert
    expect(board.vehicles).toEqual([{ id: 'X', orientation: 'H', row: 2, col: 2, length: 2 }])
  })

  test('lit un camion vertical de 3 cases', () => {
    // Arrange
    const map = ['......', '......', 'XX...C', '.....C', '.....C', '......']

    // Act
    const board = parseBoard(map)

    // Assert
    expect(board.vehicles).toContainEqual({ id: 'C', orientation: 'V', row: 2, col: 5, length: 3 })
  })
})
