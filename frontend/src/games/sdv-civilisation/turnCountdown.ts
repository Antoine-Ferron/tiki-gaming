/**
 * Affichage du minuteur du tour, voir docs/games/sdv-civilisation/regles.md#temps-de-tour
 * L'heure limite est tenue par le serveur, qui défausse une carte au hasard à l'expiration : le front ne fait
 * qu'afficher le temps restant.
 */

export const WARNING_MS = 10_000

export type TurnPhase = 'running' | 'warning' | 'expired'

export function turnPhase(remainingMs: number): TurnPhase {
  if (remainingMs > WARNING_MS) return 'running'
  return remainingMs > 0 ? 'warning' : 'expired'
}

/** « 1:00 », « 0:09 » : secondes arrondies au-dessus, pour n'afficher 0:00 qu'à l'expiration. */
export function formatRemaining(remainingMs: number): string {
  const seconds = Math.ceil(Math.max(0, remainingMs) / 1000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}
