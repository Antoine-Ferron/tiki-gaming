import { describe, expect, test } from 'vitest'
import { branchGap } from './branches'
import { PX_PER_METER } from './game'

// EF-3.2 : l'écart entre deux branches grandit de 6 m (départ) à 19 m (à partir de 2 000 m).
// Le tirage choisit l'écart entre un minimum et un maximum qui grandissent tous deux avec la hauteur.
describe('écart entre deux branches (EF-3.2)', () => {
  test.each([
    { hauteur: 0, tirage: 0, ecart: 6 },
    { hauteur: 0, tirage: 0.999, ecart: 6 },
    { hauteur: 1000, tirage: 0, ecart: 9.25 },
    { hauteur: 1000, tirage: 1, ecart: 12.5 },
    { hauteur: 2000, tirage: 0, ecart: 12.5 },
    { hauteur: 2000, tirage: 1, ecart: 19 },
    { hauteur: 3000, tirage: 0, ecart: 12.5 },
    { hauteur: 3000, tirage: 1, ecart: 19 },
  ])('à $hauteur m avec le tirage $tirage → $ecart m', ({ hauteur, tirage, ecart }) => {
    expect(branchGap(hauteur * PX_PER_METER, () => tirage) / PX_PER_METER).toBeCloseTo(ecart, 1)
  })
})
