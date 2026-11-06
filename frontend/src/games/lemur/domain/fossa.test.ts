import { describe, expect, test } from 'vitest'
import { fossaSpeed } from './fossa'
import { PX_PER_METER } from './game'

// EF-5.2 : 4 m/s au départ, +1,2 m/s à chaque palier de 100 m atteint, plafonnée à 20 m/s.
// Valeurs limites de part et d'autre de chaque palier, et autour du plafond (1 300 m → 19,6 ; 1 400 m → 20,8 plafonné).
describe('vitesse de la fossa (EF-5.2)', () => {
  test.each([
    { hauteur: 0, vitesse: 4 },
    { hauteur: 99.9, vitesse: 4 },
    { hauteur: 100, vitesse: 5.2 },
    { hauteur: 199.9, vitesse: 5.2 },
    { hauteur: 200, vitesse: 6.4 },
    { hauteur: 1299.9, vitesse: 18.4 },
    { hauteur: 1300, vitesse: 19.6 },
    { hauteur: 1400, vitesse: 20 },
    { hauteur: 10000, vitesse: 20 },
  ])('maki monté à $hauteur m → $vitesse m/s', ({ hauteur, vitesse }) => {
    expect(fossaSpeed(hauteur * PX_PER_METER) / PX_PER_METER).toBeCloseTo(vitesse, 5)
  })
})
