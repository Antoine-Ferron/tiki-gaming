import { describe, expect, test } from 'vitest'
import { GameSession } from './session'

const E = '......'
// La voiture rouge peut avancer de 2 cases avant le camion A ; A peut monter d'une case pour la libérer
const MAP = [E, '....A.', 'XX..A.', E, E, E]

describe('GameSession : compteur de coups (P1, R6)', () => {
  test('une nouvelle partie commence à 0 coup', () => {
    // Act
    const session = new GameSession(MAP)

    // Assert
    expect(session.moveCount).toBe(0)
  })

  test('un glissement compte 1 coup, quelle que soit la distance', () => {
    // Arrange
    const session = new GameSession(MAP)

    // Act : la voiture rouge avance de 2 cases d'un seul geste
    session.move('X', 2)

    // Assert
    expect(session.moveCount).toBe(1)
    expect(session.moves).toEqual([{ id: 'X', delta: 2 }])
  })

  test('un glissement impossible est refusé et ne compte pas', () => {
    // Arrange
    const session = new GameSession(MAP)

    // Act
    const move = () => session.move('X', 3)

    // Assert
    expect(move).toThrow('Déplacement impossible')
    expect(session.moveCount).toBe(0)
  })
})

describe('GameSession : Annuler (P3)', () => {
  test('revient au plateau d’avant le dernier coup et retire ce coup', () => {
    // Arrange
    const session = new GameSession(MAP)
    const start = session.board
    session.move('X', 2)

    // Act
    session.undo()

    // Assert
    expect(session.board).toEqual(start)
    expect(session.moveCount).toBe(0)
  })

  test('n’annule que le dernier coup', () => {
    // Arrange
    const session = new GameSession(MAP)
    session.move('X', 1)
    const afterFirst = session.board
    session.move('X', 1)

    // Act
    session.undo()

    // Assert
    expect(session.board).toEqual(afterFirst)
    expect(session.moves).toEqual([{ id: 'X', delta: 1 }])
  })

  test('sans coup joué, ne fait rien', () => {
    // Arrange
    const session = new GameSession(MAP)
    const start = session.board

    // Act
    session.undo()

    // Assert
    expect(session.board).toEqual(start)
    expect(session.moveCount).toBe(0)
  })
})
