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

// Plateau minimal valide : la voiture rouge seule sur la 3ᵉ ligne
const EMPTY_ROW = '......'
const VALID = [EMPTY_ROW, EMPTY_ROW, 'XX....', EMPTY_ROW, EMPTY_ROW, EMPTY_ROW]

describe('parseBoard : le plateau fait 6 × 6 cases (R1)', () => {
  // Valeurs limites sur le nombre de lignes : 5 (N-1) refusé, 6 (N) accepté, 7 (N+1) refusé
  test.each([
    { rows: 5, valid: false },
    { rows: 6, valid: true },
    { rows: 7, valid: false },
  ])('$rows lignes → valide : $valid', ({ rows, valid }) => {
    // Arrange
    const map = [...VALID, EMPTY_ROW].slice(0, rows)

    // Act
    const parse = () => parseBoard(map)

    // Assert
    if (valid) expect(parse).not.toThrow()
    else expect(parse).toThrow('Le plateau doit faire 6 lignes de 6 cases')
  })

  // Valeurs limites sur la longueur d'une ligne : 5, 6, 7 cases
  test.each([
    { row: '.....', valid: false },
    { row: '......', valid: true },
    { row: '.......', valid: false },
  ])('une ligne de $row.length cases → valide : $valid', ({ row, valid }) => {
    // Arrange
    const map = [row, ...VALID.slice(1)]

    // Act
    const parse = () => parseBoard(map)

    // Assert
    if (valid) expect(parse).not.toThrow()
    else expect(parse).toThrow('Le plateau doit faire 6 lignes de 6 cases')
  })
})

describe('parseBoard : véhicules de 2 ou 3 cases, d’un seul tenant (R2)', () => {
  // Valeurs limites sur la longueur : 1 et 4 refusées, 2 et 3 acceptées
  test.each([
    { row: 'A.....', valid: false },
    { row: 'AA....', valid: true },
    { row: 'AAA...', valid: true },
    { row: 'AAAA..', valid: false },
  ])('véhicule "$row" → valide : $valid', ({ row, valid }) => {
    // Arrange
    const map = [row, ...VALID.slice(1)]

    // Act
    const parse = () => parseBoard(map)

    // Assert
    if (valid) expect(parse).not.toThrow()
    else expect(parse).toThrow('Le véhicule A doit mesurer 2 ou 3 cases')
  })

  test.each([
    { shape: 'en pointillés', top: ['A.A...', EMPTY_ROW] },
    { shape: 'en L', top: ['AA....', 'A.....'] },
  ])('refuse un véhicule $shape', ({ top }) => {
    // Arrange
    const map = [...top, ...VALID.slice(2)]

    // Act
    const parse = () => parseBoard(map)

    // Assert
    expect(parse).toThrow('Le véhicule A doit être d’un seul tenant')
  })

  test.each(['##....', 'aa....', '11....'])('refuse un caractère interdit ("%s")', (row) => {
    // Arrange
    const map = [row, ...VALID.slice(1)]

    // Act
    const parse = () => parseBoard(map)

    // Assert
    expect(parse).toThrow('Caractère interdit')
  })
})

describe('parseBoard : la voiture rouge est horizontale sur la 3ᵉ ligne (R3)', () => {
  test.each([
    { name: 'absente', map: [EMPTY_ROW, EMPTY_ROW, 'AA....', EMPTY_ROW, EMPTY_ROW, EMPTY_ROW] },
    { name: 'verticale', map: [EMPTY_ROW, 'X.....', 'X.....', EMPTY_ROW, EMPTY_ROW, EMPTY_ROW] },
    { name: 'sur la 2ᵉ ligne', map: [EMPTY_ROW, 'XX....', EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW] },
    { name: 'sur la 4ᵉ ligne', map: [EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, 'XX....', EMPTY_ROW, EMPTY_ROW] },
  ])('refuse une voiture rouge $name', ({ map }) => {
    // Act
    const parse = () => parseBoard(map)

    // Assert
    expect(parse).toThrow('La voiture rouge X doit être horizontale, sur la 3ᵉ ligne')
  })
})
