// Invariants de LemurTiki, vrais pour n'importe quelle partie générée par fast-check.
// Les exemples des .feature fixent les frontières ; ces propriétés couvrent tout l'espace entre elles.
import fc from 'fast-check'
import { describe, expect, test } from 'vitest'
import { aGame } from '../testing/builders'
import { advance } from './advance'
import { growBranches, type Random } from './branches'
import { fossaSpeed } from './fossa'
import { BRANCH_WIDTH, GRAVITY, type Input, JUMP_SPEED, step, WORLD_WIDTH } from './game'
import { MAX_SCORE, score } from './score'

const JUMP_HEIGHT = JUMP_SPEED ** 2 / (2 * GRAVITY)

const input: fc.Arbitrary<Input> = fc.record({ left: fc.boolean(), right: fc.boolean() })
const draw = fc.double({ min: 0, max: 1, maxExcluded: true, noNaN: true })
/** Tirage au sort rejouable : renvoie les valeurs générées, en boucle. */
const randomFrom = (draws: number[]): Random => {
  let i = 0
  return () => draws[i++ % draws.length]
}
const maki = fc.record({
  x: fc.double({ min: 0, max: WORLD_WIDTH, maxExcluded: true, noNaN: true }),
  y: fc.double({ min: 0, max: 100_000, noNaN: true }),
  vy: fc.double({ min: -JUMP_SPEED, max: JUMP_SPEED, noNaN: true }),
})

describe('LemurTiki (propriétés)', () => {
  test("le maki reste toujours dans la largeur de l'écran, quelle que soit la direction (EF-1.5)", () => {
    fc.assert(
      fc.property(maki, fc.array(input, { maxLength: 200 }), (start, inputs) => {
        let state = aGame({ maki: start })
        for (const i of inputs) {
          state = step(state, i)
          expect(state.maki.x).toBeGreaterThanOrEqual(0)
          expect(state.maki.x).toBeLessThan(WORLD_WIDTH)
        }
      }),
    )
  })

  test('la caméra et la hauteur maximale ne redescendent jamais (EF-2, EF-6.4)', () => {
    fc.assert(
      fc.property(
        maki,
        fc.array(input, { maxLength: 200 }),
        fc.array(draw, { minLength: 1 }),
        (start, inputs, draws) => {
          const random = randomFrom(draws)
          let state = aGame({ maki: start, peakY: start.y, fossaY: -1000 })
          for (const i of inputs) {
            const next = advance(state, i, random)
            expect(next.cameraY).toBeGreaterThanOrEqual(state.cameraY)
            expect(next.peakY).toBeGreaterThanOrEqual(state.peakY)
            state = next
          }
        },
      ),
    )
  })

  test('une partie terminée ne change plus, quoi que fasse le joueur (EF-6.3)', () => {
    fc.assert(
      fc.property(maki, fc.constantFrom('fall' as const, 'fossa' as const), input, draw, (start, over, i, d) => {
        const ended = aGame({ maki: start, over })
        expect(advance(ended, i, () => d)).toBe(ended)
      }),
    )
  })

  test('les branches restent à portée de saut et dans la largeur de l’écran, pour tout tirage (EF-3.2)', () => {
    fc.assert(
      fc.property(fc.array(draw, { minLength: 1 }), fc.integer({ min: 0, max: 30_000 }), (draws, bottom) => {
        const state = growBranches(aGame({ cameraY: bottom }), randomFrom(draws))
        const heights = state.branches.map((b) => b.y).sort((a, b) => a - b)
        for (let k = 1; k < heights.length; k++) expect(heights[k] - heights[k - 1]).toBeLessThan(JUMP_HEIGHT)
        for (const b of state.branches) {
          expect(b.x).toBeGreaterThanOrEqual(0)
          expect(b.x + BRANCH_WIDTH).toBeLessThanOrEqual(WORLD_WIDTH)
        }
      }),
    )
  })

  test('la fossa ne ralentit jamais en montant, et reste entre 4 et 20 m/s (EF-5.2)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1e7, noNaN: true }),
        fc.double({ min: 0, max: 1e7, noNaN: true }),
        (a, b) => {
          const [low, high] = a <= b ? [a, b] : [b, a]
          expect(fossaSpeed(low)).toBeLessThanOrEqual(fossaSpeed(high))
          expect(fossaSpeed(low)).toBeGreaterThanOrEqual(40)
          expect(fossaSpeed(high)).toBeLessThanOrEqual(200)
        },
      ),
    )
  })

  test('le score est un entier entre 0 et 100 000, qui ne baisse pas quand on monte plus haut (EF-6.4, EF-6.5)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 2e6, noNaN: true }),
        fc.double({ min: 0, max: 2e6, noNaN: true }),
        fc.nat({ max: 20_000 }),
        (a, b, vanilla) => {
          const [low, high] = a <= b ? [a, b] : [b, a]
          const lowScore = score(aGame({ peakY: low, vanilla }))
          expect(Number.isInteger(lowScore)).toBe(true)
          expect(lowScore).toBeGreaterThanOrEqual(0)
          expect(lowScore).toBeLessThanOrEqual(MAX_SCORE)
          expect(score(aGame({ peakY: high, vanilla }))).toBeGreaterThanOrEqual(lowScore)
        },
      ),
    )
  })
})
