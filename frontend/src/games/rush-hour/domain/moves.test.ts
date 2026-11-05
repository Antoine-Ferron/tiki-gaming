import { describe, expect, test } from 'vitest'
import { type Board, parseBoard } from './board'
import { getLevel } from './levels'
import { isSolved, moveRange, moveVehicle } from './moves'

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

describe('moveVehicle : un coup = un glissement dans son sens (R4 à R6)', () => {
  // La voiture rouge peut avancer de 0 à 2 cases avant le camion A. Lu dans chaque test (et non au chargement du
  // fichier) : sinon Stryker voit le parseur comme du code « statique » et relance toute la suite par mutant.
  const start = () => parseBoard([E, '....A.', 'XX..A.', E, E, E])
  const colOf = (b: Board, id: string) => b.vehicles.find((v) => v.id === id)?.col

  test.each([
    { delta: 2, col: 2 }, // jusqu'à l'obstacle (N)
    { delta: 1, col: 1 },
  ])('avance la voiture rouge de $delta case(s)', ({ delta, col }) => {
    // Act
    const next = moveVehicle(start(), 'X', delta)

    // Assert
    expect(colOf(next, 'X')).toBe(col)
  })

  // Valeurs limites : une case au-delà de l'amplitude, dans chaque sens
  test.each([
    { delta: 3, error: 'Déplacement impossible : X de 3' }, // N+1 vers le camion
    { delta: -1, error: 'Déplacement impossible : X de -1' }, // contre le bord gauche
    { delta: 0, error: 'Déplacement nul' },
  ])('refuse un glissement de $delta', ({ delta, error }) => {
    // Act
    const move = () => moveVehicle(start(), 'X', delta)

    // Assert
    expect(move).toThrow(error)
  })

  test('laisse le plateau de départ et les autres véhicules inchangés', () => {
    // Arrange
    const board = start()

    // Act
    const next = moveVehicle(board, 'X', 2)

    // Assert
    expect(colOf(board, 'X')).toBe(0)
    expect(next.vehicles.find((v) => v.id === 'A')).toEqual(board.vehicles.find((v) => v.id === 'A'))
  })

  test('un véhicule vertical change de ligne, pas de colonne', () => {
    // Act : le camion A descend d'une case
    const next = moveVehicle(start(), 'A', 1)

    // Assert
    expect(next.vehicles.find((v) => v.id === 'A')).toMatchObject({ row: 2, col: 4 })
  })
})

describe('isSolved : la voiture rouge touche la sortie (R7)', () => {
  // Valeurs limites : contre le bord droit (N) → gagné ; une case avant (N-1) → pas encore
  test.each([
    { row: '....XX', solved: true },
    { row: '...XX.', solved: false },
  ])('voiture rouge en "$row" → gagné : $solved', ({ row, solved }) => {
    // Arrange
    const board = parseBoard([E, E, row, E, E, E])

    // Act
    const result = isSolved(board)

    // Assert
    expect(result).toBe(solved)
  })

  test('le niveau 1 n’est pas gagné au départ', () => {
    // Arrange
    const board = parseBoard(getLevel(1).map)

    // Act
    const result = isSolved(board)

    // Assert
    expect(result).toBe(false)
  })
})
