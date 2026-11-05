import { describe, expect, test } from 'vitest'
import { keyToDirection } from './keyboard'

describe('keyToDirection', () => {
  test.each([
    { key: 'ArrowLeft', direction: 'left' },
    { key: 'ArrowRight', direction: 'right' },
    { key: 'ArrowUp', direction: 'up' },
    { key: 'ArrowDown', direction: 'down' },
  ])('la flèche $key joue vers $direction', ({ key, direction }) => {
    // Act
    const result = keyToDirection(key)

    // Assert
    expect(result).toBe(direction)
  })

  test.each([
    { key: 'z', direction: 'up' },
    { key: 'q', direction: 'left' },
    { key: 's', direction: 'down' },
    { key: 'd', direction: 'right' },
    { key: 'w', direction: 'up' },
    { key: 'a', direction: 'left' },
    { key: 'Z', direction: 'up' },
    { key: 'D', direction: 'right' },
  ])('la lettre $key joue vers $direction (ZQSD et WASD, majuscule ou non)', ({ key, direction }) => {
    // Act
    const result = keyToDirection(key)

    // Assert
    expect(result).toBe(direction)
  })

  test.each(['Enter', ' ', 'Tab', 'x', 'Escape', ''])('la touche "%s" ne joue pas', (key) => {
    // Act
    const result = keyToDirection(key)

    // Assert
    expect(result).toBeNull()
  })
})
