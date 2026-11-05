// Propriétés du glisser-déposer vérifiées avec fast-check, en complément des valeurs limites de drag.test.ts :
// le véhicule ne sort jamais de ses cases libres, et l'arrondi au lâcher est le même dans les deux sens (BUG-04).
import fc from 'fast-check'
import { describe, expect, test } from 'vitest'
import { dragOffset, dropDelta } from './drag'

const distance = fc.double({ min: -1000, max: 1000, noNaN: true })
const cell = fc.double({ min: 1, max: 200, noNaN: true })
const range = fc
  .tuple(fc.integer({ min: -4, max: 0 }), fc.integer({ min: 0, max: 4 }))
  .map(([min, max]) => ({ min, max }))
// Des décalages quelconques, et des demi-cases exactes (±0,5, ±1,5…) : c'est là que l'arrondi peut différer selon le sens.
const offset = fc.oneof(
  fc.double({ min: -5, max: 5, noNaN: true }),
  fc.integer({ min: -10, max: 10 }).map((n) => n / 2),
)

describe('drag (propriétés)', () => {
  test('le décalage reste toujours entre les bornes des cases libres', () => {
    fc.assert(
      fc.property(distance, cell, range, (d, c, r) => {
        // Act
        const result = dragOffset(d, c, r)

        // Assert
        expect(result).toBeGreaterThanOrEqual(r.min)
        expect(result).toBeLessThanOrEqual(r.max)
      }),
    )
  })

  test('au lâcher, le véhicule va sur la case la plus proche, de la même façon dans les deux sens', () => {
    fc.assert(
      fc.property(offset, (o) => {
        // Act
        const delta = dropDelta(o)

        // Assert
        expect(Number.isInteger(delta)).toBe(true)
        expect(Math.abs(delta - o)).toBeLessThanOrEqual(0.5)
        // === et non toBe : 0 et -0 désignent la même case (toBe les distingue)
        expect(dropDelta(-o) === -delta).toBe(true)
      }),
    )
  })
})
