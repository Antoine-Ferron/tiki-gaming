// Propriétés et fuzzing de la sauvegarde et du score (fast-check), en complément des valeurs limites de save.test.ts.
import fc from 'fast-check'
import { describe, expect, test } from 'vitest'
import { MAX_SCORE, saveSchema, scoreToSubmit, WEAPON_IDS } from './save'

const count = fc.nat({ max: 10_000_000 })

// Une sauvegarde valide quelconque : c'est ce que le jeu écrit avec ctx.save.
const validSave = fc.record({
  version: fc.constant(1 as const),
  money: count,
  totalEarned: count,
  armor: fc.integer({ min: 0, max: 100 }),
  inventory: fc.option(
    fc.array(fc.record({ id: fc.constantFrom(...WEAPON_IDS), clip: count, ammo: count }), { maxLength: 7 }),
    { nil: null },
  ),
  completedMissions: fc.array(fc.string(), { maxLength: 4 }),
  stats: fc.record({ kills: count, wantedMax: count, playTime: fc.double({ min: 0, max: 1e7, noNaN: true }) }),
})

describe('sauvegarde (propriétés et fuzzing)', () => {
  test('fuzzing : n’importe quelle donnée stockée est acceptée ou refusée, jamais une exception', () => {
    fc.assert(
      fc.property(fc.anything(), (stored) => {
        // Act
        const parsed = saveSchema.safeParse(stored)

        // Assert : une sauvegarde acceptée respecte toujours les invariants du jeu
        if (parsed.success) {
          expect(Number.isInteger(parsed.data.money) && parsed.data.money >= 0).toBe(true)
          expect(parsed.data.armor).toBeGreaterThanOrEqual(0)
          expect(parsed.data.armor).toBeLessThanOrEqual(100)
        }
      }),
    )
  })

  test('toute sauvegarde écrite par le jeu se relit à l’identique après passage en JSON', () => {
    fc.assert(
      fc.property(validSave, (save) => {
        // Act
        const parsed = saveSchema.safeParse(JSON.parse(JSON.stringify(save)))

        // Assert
        expect(parsed.success).toBe(true)
        expect(parsed.data).toEqual(save)
      }),
    )
  })
})

describe('scoreToSubmit (propriétés)', () => {
  const lastSent = fc.option(fc.nat({ max: MAX_SCORE }), { nil: null })

  test('le score envoyé bat toujours le précédent et ne dépasse jamais le plafond', () => {
    fc.assert(
      fc.property(count, lastSent, (earned, last) => {
        // Act
        const score = scoreToSubmit(earned, last)

        // Assert
        if (score !== null) {
          expect(score).toBeGreaterThan(last ?? 0)
          expect(score).toBeLessThanOrEqual(MAX_SCORE)
        }
      }),
    )
  })

  test('un gain qui bat le précédent sous le plafond est toujours envoyé, tel quel', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: MAX_SCORE }), (earned) => {
        // Act + Assert
        expect(scoreToSubmit(earned, earned - 1)).toBe(earned)
      }),
    )
  })
})
