/**
 * Décalage en cases (avec décimales) pendant le glissé : la distance parcourue par la souris, bornée aux cases libres.
 * Sans largeur de case (plateau pas encore affiché), le véhicule ne bouge pas.
 */
export function dragOffset(distance: number, cell: number, range: { min: number; max: number }): number {
  if (cell <= 0) return 0
  return Math.min(range.max, Math.max(range.min, distance / cell))
}

/**
 * Nombre de cases parcourues au lâcher : la case la plus proche, une moitié comptant pour une case entière dans les
 * deux sens (`Math.round` arrondit -0,5 vers 0 : glisser vers la gauche demandait plus d'effort que vers la droite).
 */
export function dropDelta(offset: number): number {
  return Math.sign(offset) * Math.round(Math.abs(offset)) || 0
}
