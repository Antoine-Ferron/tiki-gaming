/**
 * Moteur de Prismine : géométrie de la galerie, trajet des faisceaux et génération des étages.
 * Module pur (sans React ni réseau) : un étage est entièrement défini par sa profondeur et sa graine.
 */

/** Contenu d'une case : vide, cristal-miroir « / » ou « \ », obsidienne (absorbe la lumière). */
export type Piece = '.' | '/' | '\\' | '#'

/** Carte d'une galerie : taille × taille cases lues ligne par ligne, une `Piece` par caractère. */
export type Grid = string

export type FloorSpec = { size: number; crystals: number; obsidians: number }

export type Floor = FloorSpec & { depth: number; seed: number; grid: Grid }

/** Résultat d'un tir : entrée par laquelle le faisceau ressort (null s'il est absorbé) et nombre de rebonds. */
export type Outcome = { exit: number | null; bounces: number }

/**
 * Trajet d'un faisceau, pour le dessiner : point de départ (hors galerie), cases où il tourne,
 * puis point de sortie (hors galerie) ou case d'obsidienne qui l'absorbe.
 * Coordonnées en cases : -1 et `size` désignent le bord.
 */
export type Trace = Outcome & { path: [row: number, col: number][] }

/** Taille et pièces cachées de chaque étage ; au-delà du dernier, la difficulté plafonne. */
const FLOORS: FloorSpec[] = [
  { size: 6, crystals: 3, obsidians: 0 },
  { size: 6, crystals: 4, obsidians: 0 },
  { size: 7, crystals: 4, obsidians: 1 },
  { size: 7, crystals: 5, obsidians: 1 },
  { size: 8, crystals: 6, obsidians: 1 },
  { size: 8, crystals: 7, obsidians: 1 },
  { size: 8, crystals: 7, obsidians: 2 },
  { size: 8, crystals: 8, obsidians: 2 },
]

export function floorSpec(depth: number): FloorSpec {
  return FLOORS[Math.min(Math.max(depth, 1), FLOORS.length) - 1]
}

export function emptyGrid(size: number): Grid {
  return '.'.repeat(size * size)
}

export function withPiece(grid: Grid, cell: number, piece: Piece): Grid {
  return grid.slice(0, cell) + piece + grid.slice(cell + 1)
}

export function countPieces(grid: Grid) {
  let crystals = 0
  let obsidians = 0
  for (const piece of grid) {
    if (piece === '#') obsidians++
    else if (piece !== '.') crystals++
  }
  return { crystals, obsidians }
}

/** Ordre de pose au clic : vide → / → \ → obsidienne (seulement si l'étage en cache) → vide. */
export function nextPiece(piece: Piece, withObsidian: boolean, backwards = false): Piece {
  const order: Piece[] = withObsidian ? ['.', '/', '\\', '#'] : ['.', '/', '\\']
  const index = Math.max(order.indexOf(piece), 0)
  return order[(index + (backwards ? order.length - 1 : 1)) % order.length]
}

// ---------------------------------------------------------------------------------------------
// Entrées et faisceaux

// Directions : 0 = nord, 1 = est, 2 = sud, 3 = ouest.
const DR = [-1, 0, 1, 0]
const DC = [0, 1, 0, -1]
const LETTERS = 'ABCDEFGHIJKL'

/**
 * Les 4 × taille entrées sont numérotées dans le sens horaire : haut (de gauche à droite),
 * droite (de haut en bas), bas (de droite à gauche), gauche (de bas en haut).
 */
export function entryCount(size: number) {
  return 4 * size
}

/** Position de l'entrée (hors galerie) et direction du faisceau qui y entre. */
export function entryStart(entry: number, size: number) {
  const i = entry % size
  switch (Math.floor(entry / size)) {
    case 0:
      return { row: -1, col: i, dir: 2 }
    case 1:
      return { row: i, col: size, dir: 3 }
    case 2:
      return { row: size, col: size - 1 - i, dir: 0 }
    default:
      return { row: size - 1 - i, col: -1, dir: 1 }
  }
}

/** Entrée située à une position du bord (row ou col vaut -1 ou `size`). */
export function entryAt(row: number, col: number, size: number): number {
  if (row < 0) return col
  if (col >= size) return size + row
  if (row >= size) return 2 * size + (size - 1 - col)
  return 3 * size + (size - 1 - row)
}

/** Repère d'une entrée : lettre de sa colonne (haut, bas) ou numéro de sa ligne (gauche, droite). */
export function entryCoord(entry: number, size: number): string {
  const { row, col } = entryStart(entry, size)
  return row < 0 || row >= size ? LETTERS[col] : String(row + 1)
}

/** « Haut C », « Droite 4 »… */
export function entryName(entry: number, size: number): string {
  const side = ['Haut', 'Droite', 'Bas', 'Gauche'][Math.floor(entry / size)]
  return `${side} ${entryCoord(entry, size)}`
}

export function cellName(cell: number, size: number): string {
  return `${LETTERS[cell % size]}${Math.floor(cell / size) + 1}`
}

export function trace(grid: Grid, size: number, entry: number): Trace {
  let { row, col, dir } = entryStart(entry, size)
  const path: Trace['path'] = [[row, col]]
  let bounces = 0
  // Les cristaux réfléchissent des deux côtés : un trajet est réversible, il ne peut pas boucler et
  // finit toujours par ressortir ou être absorbé. La borne (case × direction) n'est qu'un garde-fou.
  for (let step = 0; step <= 4 * size * size; step++) {
    row += DR[dir]
    col += DC[dir]
    if (row < 0 || col < 0 || row >= size || col >= size) {
      path.push([row, col])
      return { exit: entryAt(row, col, size), bounces, path }
    }
    const piece = grid[row * size + col]
    if (piece === '#') {
      path.push([row, col])
      return { exit: null, bounces, path }
    }
    if (piece === '/' || piece === '\\') {
      // « / » : nord ↔ est, sud ↔ ouest. « \ » : nord ↔ ouest, sud ↔ est.
      dir = piece === '/' ? dir ^ 1 : 3 - dir
      bounces++
      path.push([row, col])
    }
  }
  return { exit: null, bounces, path }
}

export function sameOutcome(a: Outcome, b: Outcome) {
  return a.exit === b.exit && a.bounces === b.bounces
}

/** Entrées dont le tir ne donne pas le même résultat sur les deux cartes (vide = cartes équivalentes). */
export function differingEntries(a: Grid, b: Grid, size: number): number[] {
  const entries: number[] = []
  for (let entry = 0; entry < entryCount(size); entry++) {
    if (!sameOutcome(trace(a, size, entry), trace(b, size, entry))) entries.push(entry)
  }
  return entries
}

// ---------------------------------------------------------------------------------------------
// Génération

/** Générateur pseudo-aléatoire déterministe (mulberry32) : même graine, même étage. */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function randomSeed() {
  return Math.floor(Math.random() * 2 ** 32)
}

export function generateFloor(depth: number, seed: number): Floor {
  const spec = floorSpec(depth)
  const random = mulberry32(seed)
  let grid = randomGrid(spec, random)
  // Une pièce qu'aucun faisceau ne peut atteindre serait impossible à deviner : on recommence le tirage.
  for (let attempt = 1; attempt < 100 && !allPiecesReachable(grid, spec.size); attempt++) {
    grid = randomGrid(spec, random)
  }
  return { ...spec, depth, seed, grid }
}

function randomGrid({ size, crystals, obsidians }: FloorSpec, random: () => number): Grid {
  const cells: Piece[] = Array<Piece>(size * size).fill('.')
  const free = cells.map((_, cell) => cell)
  const place = (piece: Piece) => {
    const [cell] = free.splice(Math.floor(random() * free.length), 1)
    cells[cell] = piece
  }
  for (let n = 0; n < crystals; n++) place(random() < 0.5 ? '/' : '\\')
  for (let n = 0; n < obsidians; n++) place('#')
  return cells.join('')
}

function allPiecesReachable(grid: Grid, size: number): boolean {
  const touched = new Set<number>()
  for (let entry = 0; entry < entryCount(size); entry++) {
    for (const [row, col] of trace(grid, size, entry).path) {
      if (row >= 0 && col >= 0 && row < size && col < size) touched.add(row * size + col)
    }
  }
  return [...grid].every((piece, cell) => piece === '.' || touched.has(cell))
}
