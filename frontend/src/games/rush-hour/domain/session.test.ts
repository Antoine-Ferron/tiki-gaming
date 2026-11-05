import { describe, expect, test } from 'vitest'
import { ManualClock } from '../testing/manualClock'
import { GameSession } from './session'

const E = '......'
// La voiture rouge peut avancer de 2 cases avant le camion A ; A peut monter d'une case pour la libérer
const MAP = [E, '....A.', 'XX..A.', E, E, E]

describe('GameSession : compteur de coups (P1, R6)', () => {
  test('une nouvelle partie commence à 0 coup', () => {
    // Act
    const session = new GameSession(MAP, new ManualClock())

    // Assert
    expect(session.moveCount).toBe(0)
  })

  test('un glissement compte 1 coup, quelle que soit la distance', () => {
    // Arrange
    const session = new GameSession(MAP, new ManualClock())

    // Act : la voiture rouge avance de 2 cases d'un seul geste
    session.move('X', 2)

    // Assert
    expect(session.moveCount).toBe(1)
    expect(session.moves).toEqual([{ id: 'X', delta: 2 }])
  })

  test('un glissement impossible est refusé et ne compte pas', () => {
    // Arrange
    const session = new GameSession(MAP, new ManualClock())

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
    const session = new GameSession(MAP, new ManualClock())
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
    const session = new GameSession(MAP, new ManualClock())
    session.move('X', 1)
    const afterFirst = session.board
    session.move('A', -1)

    // Act
    session.undo()

    // Assert
    expect(session.board).toEqual(afterFirst)
    expect(session.moves).toEqual([{ id: 'X', delta: 1 }])
  })

  test('sans coup joué, ne fait rien', () => {
    // Arrange
    const session = new GameSession(MAP, new ManualClock())
    const start = session.board

    // Act
    session.undo()

    // Assert
    expect(session.board).toEqual(start)
    expect(session.moveCount).toBe(0)
  })
})

describe('GameSession : victoire et chrono (P2, P6)', () => {
  // Solution : le camion A monte d'une case, puis la voiture rouge sort (4 cases)
  const win = (session: GameSession) => {
    session.move('A', -1)
    session.move('X', 4)
  }

  test('la partie est gagnée quand la voiture rouge touche la sortie', () => {
    // Arrange
    const session = new GameSession(MAP, new ManualClock())

    // Act
    win(session)

    // Assert
    expect(session.solved).toBe(true)
  })

  test('après la victoire, plus aucun déplacement ni annulation', () => {
    // Arrange
    const session = new GameSession(MAP, new ManualClock())
    win(session)
    const final = session.board

    // Act
    const move = () => session.move('A', 1)
    session.undo()

    // Assert
    expect(move).toThrow('Partie terminée')
    expect(session.board).toEqual(final)
    expect(session.moveCount).toBe(2)
  })

  test('le chrono tourne pendant la partie et s’arrête à la victoire', () => {
    // Arrange
    const clock = new ManualClock(1_000)
    const session = new GameSession(MAP, clock)

    // Act
    clock.advance(5_000)
    session.move('A', -1)
    clock.advance(2_500)
    session.move('X', 4)
    clock.advance(60_000)

    // Assert
    expect(session.elapsedMs).toBe(7_500)
  })
})

describe('GameSession : Recommencer (P4)', () => {
  test('remet le plateau de départ, les coups et le chrono à zéro', () => {
    // Arrange
    const clock = new ManualClock()
    const session = new GameSession(MAP, clock)
    const start = session.board
    clock.advance(3_000)
    session.move('X', 1)

    // Act
    session.reset()
    clock.advance(1_000)

    // Assert
    expect(session.board).toEqual(start)
    expect(session.moveCount).toBe(0)
    expect(session.elapsedMs).toBe(1_000)
  })

  test('permet de rejouer après une victoire', () => {
    // Arrange
    const session = new GameSession(MAP, new ManualClock())
    session.move('A', -1)
    session.move('X', 4)

    // Act
    session.reset()

    // Assert
    expect(session.solved).toBe(false)
    expect(() => session.move('X', 1)).not.toThrow()
  })
})

describe('GameSession : un même véhicule déplacé plusieurs fois de suite = un seul coup (R6)', () => {
  test('deux glissements de suite du même véhicule comptent 1 coup', () => {
    // Arrange
    const session = new GameSession(MAP, new ManualClock())

    // Act : au clavier, la voiture rouge avance case par case
    session.move('X', 1)
    session.move('X', 1)

    // Assert
    expect(session.moveCount).toBe(1)
    expect(session.moves).toEqual([{ id: 'X', delta: 2 }])
  })

  test('un aller-retour du même véhicule ne compte aucun coup', () => {
    // Arrange
    const session = new GameSession(MAP, new ManualClock())

    // Act
    session.move('X', 1)
    session.move('X', -1)

    // Assert
    expect(session.moveCount).toBe(0)
  })

  test('un autre véhicule entre les deux : 3 coups distincts', () => {
    // Arrange
    const session = new GameSession(MAP, new ManualClock())

    // Act
    session.move('X', 1)
    session.move('A', -1)
    session.move('X', 1)

    // Assert
    expect(session.moveCount).toBe(3)
  })

  test('Annuler annule tout le coup regroupé', () => {
    // Arrange
    const session = new GameSession(MAP, new ManualClock())
    const start = session.board
    session.move('X', 1)
    session.move('X', 1)

    // Act
    session.undo()

    // Assert
    expect(session.board).toEqual(start)
    expect(session.moveCount).toBe(0)
  })
})

describe('GameSession : indices (P5)', () => {
  test('l’indice est le prochain coup de la solution la plus courte, et il est compté', () => {
    // Arrange
    const session = new GameSession(MAP, new ManualClock())

    // Act
    const hint = session.hint()

    // Assert : il faut d'abord faire monter le camion A
    expect(hint).toEqual({ id: 'A', delta: -1 })
    expect(session.hintsUsed).toBe(1)
  })

  test('l’indice tient compte de la position actuelle', () => {
    // Arrange
    const session = new GameSession(MAP, new ManualClock())
    session.move('A', -1)

    // Act
    const hint = session.hint()

    // Assert
    expect(hint).toEqual({ id: 'X', delta: 4 })
  })

  test('plateau sans solution : pas d’indice, et rien n’est compté', () => {
    // Arrange : un camion horizontal sur la ligne de la sortie, la voiture rouge ne passera jamais
    const session = new GameSession(['......', '......', 'XX.AAA', '......', '......', '......'], new ManualClock())

    // Act
    const hint = session.hint()

    // Assert
    expect(hint).toBeNull()
    expect(session.hintsUsed).toBe(0)
  })

  test('après la victoire, plus d’indice et rien n’est compté', () => {
    // Arrange
    const session = new GameSession(MAP, new ManualClock())
    session.move('A', -1)
    session.move('X', 4)

    // Act
    const hint = session.hint()

    // Assert
    expect(hint).toBeNull()
    expect(session.hintsUsed).toBe(0)
  })

  test('Recommencer remet les indices à zéro', () => {
    // Arrange
    const session = new GameSession(MAP, new ManualClock())
    session.hint()

    // Act
    session.reset()

    // Assert
    expect(session.hintsUsed).toBe(0)
  })
})
