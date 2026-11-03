export const GRID_SIZE = 10

export type Orientation = 'horizontal' | 'vertical'
export type Coord = { row: number; col: number }
export type Ship = { name: string; size: number }

export const FLEET: Ship[] = [
  { name: 'Porte-avions', size: 5 },
  { name: 'Croiseur', size: 4 },
  { name: 'Contre-torpilleur', size: 3 },
  { name: 'Sous-marin', size: 3 },
  { name: 'Torpilleur', size: 2 },
]

export type PlacedShip = { ship: Ship; coords: Coord[] }
export type ShotResult = 'hit' | 'miss' | 'repeat'

export function coordKey(c: Coord): string {
  return `${c.row},${c.col}`
}

export function isInBounds(c: Coord): boolean {
  return c.row >= 0 && c.row < GRID_SIZE && c.col >= 0 && c.col < GRID_SIZE
}

export function shipCoords(start: Coord, size: number, orientation: Orientation): Coord[] {
  return Array.from({ length: size }, (_, i) =>
    orientation === 'horizontal' ? { row: start.row, col: start.col + i } : { row: start.row + i, col: start.col },
  )
}

export function canPlaceShip(existing: PlacedShip[], coords: Coord[]): boolean {
  if (!coords.every(isInBounds)) return false
  const occupied = new Set(existing.flatMap((p) => p.coords.map(coordKey)))
  return coords.every((c) => !occupied.has(coordKey(c)))
}

/** Place toute la flotte au hasard, sans chevauchement, en tirant une case et une orientation par navire. */
export function placeFleetRandomly(random: () => number = Math.random): PlacedShip[] {
  const fleet: PlacedShip[] = []
  for (const ship of FLEET) {
    let coords: Coord[] | null = null
    while (!coords) {
      const orientation: Orientation = random() < 0.5 ? 'horizontal' : 'vertical'
      const start: Coord = { row: Math.floor(random() * GRID_SIZE), col: Math.floor(random() * GRID_SIZE) }
      const candidate = shipCoords(start, ship.size, orientation)
      if (canPlaceShip(fleet, candidate)) coords = candidate
    }
    fleet.push({ ship, coords })
  }
  return fleet
}

export function fireShot(fleet: PlacedShip[], shots: Set<string>, target: Coord): { result: ShotResult; sunk?: Ship } {
  const key = coordKey(target)
  if (shots.has(key)) return { result: 'repeat' }
  shots.add(key)
  const placed = fleet.find((p) => p.coords.some((c) => coordKey(c) === key))
  if (!placed) return { result: 'miss' }
  const sunk = placed.coords.every((c) => shots.has(coordKey(c)))
  return { result: 'hit', sunk: sunk ? placed.ship : undefined }
}

export function isFleetSunk(fleet: PlacedShip[], shots: Set<string>): boolean {
  return fleet.every((p) => p.coords.every((c) => shots.has(coordKey(c))))
}

export function countHits(fleet: PlacedShip[], shots: Set<string>): number {
  const fleetKeys = new Set(fleet.flatMap((p) => p.coords.map(coordKey)))
  let hits = 0
  for (const key of shots) if (fleetKeys.has(key)) hits++
  return hits
}

/** Plus haut = meilleur : score de base moins les tirs dans l'eau. */
export function computeScore(shots: number, hits: number): number {
  const misses = shots - hits
  return Math.max(10, 1000 + hits * 20 - misses * 10)
}

export type SubmitScore = (score: number, metadata: { shots: number; hits: number }) => Promise<boolean>

/**
 * Tire sur la flotte adverse puis, si ce tir coule son dernier navire, calcule le score et le
 * soumet via la fonction injectée. `submitScore` n'est jamais appelé pour un tir répété ni tant
 * que la flotte adverse n'est pas entièrement coulée.
 */
export async function fireAndSubmitIfOver(
  fleet: PlacedShip[],
  shots: Set<string>,
  target: Coord,
  submitScore: SubmitScore,
): Promise<{ result: ShotResult; sunk?: Ship; gameOver: boolean }> {
  const outcome = fireShot(fleet, shots, target)
  if (outcome.result === 'repeat') return { ...outcome, gameOver: false }

  const gameOver = isFleetSunk(fleet, shots)
  if (gameOver) {
    const hits = countHits(fleet, shots)
    await submitScore(computeScore(shots.size, hits), { shots: shots.size, hits })
  }
  return { ...outcome, gameOver }
}
