// Propriétés du niveau de recherche (fast-check), en complément des cas précis de Wanted.test.ts.
import fc from 'fast-check'
import { describe, expect, test } from 'vitest'
import { CRIMES, WantedLevel, type Crime } from './Wanted'

const crime = fc.constantFrom(...(Object.keys(CRIMES) as Crime[]))
const place = fc.integer({ min: -1000, max: 1000 })
const crimes = fc.array(fc.record({ crime, x: place, z: place, witnessed: fc.boolean() }), { maxLength: 30 })

describe('WantedLevel (propriétés)', () => {
  test('quels que soient les crimes, le niveau reste entre 0 et 5 étoiles et ne baisse jamais sur un crime', () => {
    fc.assert(
      fc.property(crimes, (list) => {
        // Arrange
        const w = new WantedLevel()

        for (const c of list) {
          const before = w.stars
          // Act
          w.commit(c.crime, c.x, c.z, c.witnessed)
          // Assert
          expect(w.stars).toBeGreaterThanOrEqual(before)
          expect(w.stars).toBeLessThanOrEqual(5)
          expect(w.maxStars).toBeGreaterThanOrEqual(w.stars)
        }
      }),
    )
  })

  test('un crime sans témoin ne change rien', () => {
    fc.assert(
      fc.property(crimes, crime, place, place, (list, c, x, z) => {
        // Arrange
        const w = new WantedLevel()
        for (const k of list) w.commit(k.crime, k.x, k.z, k.witnessed)
        const snapshot = { ...w, lastSeen: { ...w.lastSeen } }

        // Act
        w.commit(c, x, z, false)

        // Assert
        expect({ ...w, lastSeen: { ...w.lastSeen } }).toEqual(snapshot)
      }),
    )
  })

  test('hors de vue au point de recherche, le niveau tombe exactement au bout de son délai', () => {
    // Durées entières : la somme des deux attentes vaut exactement le délai, sans erreur d'arrondi.
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 5 }), fc.integer({ min: 0, max: 41 }), (stars, waited) => {
        // Arrange
        const w = new WantedLevel()
        w.setMinimum(stars, 0, 0)
        const delay = w.loseTime
        const before = Math.min(waited, delay - 1)

        // Act + Assert : avant le délai, il reste recherché ; au délai, il est semé
        expect(w.update(before, false, 0, 0)).toBe(false)
        expect(w.stars).toBe(stars)
        expect(w.update(delay - before, false, 0, 0)).toBe(true)
        expect(w.stars).toBe(0)
      }),
    )
  })
})
