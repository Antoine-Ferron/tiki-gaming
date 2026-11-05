import { describe, expect, test } from 'vitest'
import { slideLine } from './line'

// Une ligne est lue dans le sens du glissement : la case 0 est le bord vers lequel les tuiles partent.
// 0 = case vide. Les directions (gauche, droite…) sont gérées par la grille, pas ici.
describe('slideLine', () => {
  // R2 : les tuiles avancent jusqu'au bord ou jusqu'à la tuile suivante
  test.each([
    { before: [0, 0, 0, 0], after: [0, 0, 0, 0] }, // ligne vide
    { before: [0, 0, 0, 2], after: [2, 0, 0, 0] }, // une tuile traverse toute la ligne
    { before: [0, 2, 0, 4], after: [2, 4, 0, 0] }, // les trous disparaissent, l'ordre est gardé
    { before: [2, 4, 8, 16], after: [2, 4, 8, 16] }, // ligne pleine sans paire : rien ne bouge
  ])('glisse $before → $after sans fusion', ({ before, after }) => {
    // Act
    const result = slideLine(before)

    // Assert
    expect(result).toEqual({ line: after, points: 0 })
  })

  // R3, R4, R5 : fusion des tuiles égales, une seule fois par tuile, les plus proches du bord d'abord
  test.each([
    { before: [2, 2, 0, 0], after: [4, 0, 0, 0], points: 4 }, // deux tuiles collées
    { before: [2, 0, 0, 2], after: [4, 0, 0, 0], points: 4 }, // deux tuiles séparées par des cases vides
    { before: [2, 2, 2, 0], after: [4, 2, 0, 0], points: 4 }, // trois égales : les deux plus proches du bord
    { before: [2, 2, 2, 2], after: [4, 4, 0, 0], points: 8 }, // deux paires, pas 8 d'un coup
    { before: [2, 2, 4, 4], after: [4, 8, 0, 0], points: 12 }, // les points de chaque fusion s'additionnent
    { before: [4, 4, 8, 0], after: [8, 8, 0, 0], points: 8 }, // une tuile créée ne refusionne pas dans le même coup
    { before: [1024, 1024, 0, 0], after: [2048, 0, 0, 0], points: 2048 }, // la tuile de la victoire
  ])('fusionne $before → $after (+$points)', ({ before, after, points }) => {
    // Act
    const result = slideLine(before)

    // Assert
    expect(result).toEqual({ line: after, points })
  })

  test('ne modifie pas la ligne reçue', () => {
    // Arrange
    const before = [2, 2, 0, 0]

    // Act
    slideLine(before)

    // Assert
    expect(before).toEqual([2, 2, 0, 0])
  })
})
