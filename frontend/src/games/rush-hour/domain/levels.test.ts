import { describe, expect, test } from 'vitest'
import { getLevel } from './levels'

describe('catalogue des niveaux', () => {
  test('le niveau 1 a une map de 6 lignes de 6 cases', () => {
    // Arrange
    const id = 1

    // Act
    const level = getLevel(id)

    // Assert
    expect(level.map).toHaveLength(6)
    for (const row of level.map) expect(row).toHaveLength(6)
  })
})
