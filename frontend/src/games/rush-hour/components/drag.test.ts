import { describe, expect, test } from 'vitest'
import { dragOffset, dropDelta } from './drag'

// Calcul du glisser-déposer, sans navigateur : la distance parcourue par la souris devient un décalage en cases,
// puis un nombre de cases au lâcher. Le geste lui-même est testé en E2E (Playwright).
describe('dragOffset', () => {
  // Cases de 50 px ; le véhicule peut reculer de 2 cases ou avancer d'1 case
  const range = { min: -2, max: 1 }

  test.each([
    { label: 'immobile', distance: 0, offset: 0 },
    { label: 'une demi-case', distance: 25, offset: 0.5 },
    { label: 'pile la dernière case libre', distance: 50, offset: 1 },
    { label: 'au-delà de la dernière case libre', distance: 51, offset: 1 },
    { label: 'loin au-delà', distance: 400, offset: 1 },
    { label: 'pile la première case libre en arrière', distance: -100, offset: -2 },
    { label: 'au-delà en arrière', distance: -101, offset: -2 },
  ])('$label ($distance px) → $offset case(s)', ({ distance, offset }) => {
    // Act
    const result = dragOffset(distance, 50, range)

    // Assert
    expect(result).toBe(offset)
  })

  test('véhicule bloqué des deux côtés : il ne bouge pas', () => {
    // Act
    const result = dragOffset(80, 50, { min: 0, max: 0 })

    // Assert
    expect(result).toBe(0)
  })

  test('plateau sans largeur (pas encore affiché) : aucun décalage plutôt qu’une division par zéro', () => {
    // Act
    const result = dragOffset(80, 0, range)

    // Assert
    expect(result).toBe(0)
  })
})

describe('dropDelta', () => {
  // Au lâcher, le véhicule va sur la case la plus proche ; une moitié de case compte comme une case entière,
  // dans les deux sens
  test.each([
    { offset: 0, delta: 0 },
    { offset: 0.49, delta: 0 },
    { offset: 0.5, delta: 1 },
    { offset: 1.5, delta: 2 },
    { offset: -0.49, delta: 0 },
    { offset: -0.5, delta: -1 },
    { offset: -1.5, delta: -2 },
  ])('décalage de $offset case(s) → $delta', ({ offset, delta }) => {
    // Act
    const result = dropDelta(offset)

    // Assert
    expect(result).toBe(delta)
  })
})
