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

/** Cases d'un bloc carré centré sur `center` (rayon 1 = 3×3), bornées à la grille. */
export function zoneCoords(center: Coord, radius = 1): Coord[] {
  const coords: Coord[] = []
  for (let row = center.row - radius; row <= center.row + radius; row++) {
    for (let col = center.col - radius; col <= center.col + radius; col++) {
      const c = { row, col }
      if (isInBounds(c)) coords.push(c)
    }
  }
  return coords
}

/** Cases de `zone` occupées par un navire. Ne touche pas `shots` : une case scannée reste tirable. */
export function scanZone(fleet: PlacedShip[], zone: Coord[]): Coord[] {
  const occupied = new Set(fleet.flatMap((p) => p.coords.map(coordKey)))
  return zone.filter((c) => occupied.has(coordKey(c)))
}

export type VolleyShot = { target: Coord; result: ShotResult; sunk?: Ship }

/**
 * Applique `fireShot` à chaque case, dans l'ordre. Une case déjà tirée (même dans cette volée) est « repeat ».
 * Dès que la flotte est entièrement coulée en cours de volée (frappe nucléaire, salve), les cases restantes ne
 * sont plus de vrais tirs : les compter aurait gonflé `shots` pour rien et fait baisser le score du vainqueur.
 */
export function fireVolley(fleet: PlacedShip[], shots: Set<string>, targets: Coord[]): VolleyShot[] {
  const outcomes: VolleyShot[] = []
  let over = isFleetSunk(fleet, shots)
  for (const target of targets) {
    if (over) {
      outcomes.push({ target, result: 'repeat' })
      continue
    }
    const outcome = fireShot(fleet, shots, target)
    outcomes.push({ target, ...outcome })
    if (outcome.result === 'hit') over = isFleetSunk(fleet, shots)
  }
  return outcomes
}

export function sunkShips(fleet: PlacedShip[], shots: Set<string>): Ship[] {
  return fleet.filter((p) => p.coords.every((c) => shots.has(coordKey(c)))).map((p) => p.ship)
}

/** Position d'un navire dans `FLEET` (fixe, publique) : sert à lui attribuer une couleur stable. */
export function shipIndex(ship: Ship): number {
  return FLEET.findIndex((s) => s.name === ship.name)
}

export type FleetStatus = { ship: Ship; sunk: boolean }

/** Statut de chaque navire d'une flotte connue (la mienne, ou celle de l'adversaire en local). */
export function fleetStatus(fleet: PlacedShip[], shotsAgainst: ReadonlySet<string>): FleetStatus[] {
  return fleet.map((p) => ({ ship: p.ship, sunk: p.coords.every((c) => shotsAgainst.has(coordKey(c))) }))
}

/**
 * Statut de la flotte adverse quand on n'en connaît que les navires déjà coulés (mode en ligne : la
 * composition de `FLEET` est publique, seul son placement est secret).
 */
export function fleetStatusFromSunkNames(sunkNames: ReadonlySet<string>): FleetStatus[] {
  return FLEET.map((ship) => ({ ship, sunk: sunkNames.has(ship.name) }))
}

export type Unlocks = { salvo: boolean; radar: boolean; nuke: boolean }

/**
 * Déblocages à usage unique du mode augmenté, dérivés uniquement de mes propres tirs et navires coulés :
 * aucun état à synchroniser entre joueurs, chaque camp calcule les siens pareil.
 */
export function computeUnlocks(shotsFired: number, shipsSunk: number): Unlocks {
  return { salvo: shipsSunk >= 1, radar: shotsFired >= 5, nuke: shotsFired >= 10 }
}

export type SubmitScore = (score: number, metadata: { shots: number; hits: number }) => Promise<boolean>

/**
 * Tire sur la flotte adverse (une ou plusieurs cases à la fois : un tir simple est une volée d'une seule case)
 * puis, si la volée coule son dernier navire, calcule le score et le soumet via la fonction injectée.
 * `submitScore` n'est jamais appelé pour une volée qui ne coule rien, ni une deuxième fois après la victoire.
 * Une soumission qui échoue (réseau, compte invité…) ne doit jamais empêcher la victoire d'être enregistrée
 * localement : voir le même choix pour la soumission best-effort du mode en ligne dans `useNetGame.ts`.
 */
export async function fireVolleyAndSubmitIfOver(
  fleet: PlacedShip[],
  shots: Set<string>,
  targets: Coord[],
  submitScore: SubmitScore,
): Promise<{ outcomes: VolleyShot[]; gameOver: boolean }> {
  const alreadyOver = isFleetSunk(fleet, shots)
  const outcomes = fireVolley(fleet, shots, targets)
  const gameOver = isFleetSunk(fleet, shots)
  if (gameOver && !alreadyOver) {
    const hits = countHits(fleet, shots)
    await submitScore(computeScore(shots.size, hits), { shots: shots.size, hits }).catch(() => {})
  }
  return { outcomes, gameOver }
}
