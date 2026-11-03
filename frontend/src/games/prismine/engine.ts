/**
 * Moteur de Prismine côté navigateur : géométrie de la galerie et trajet des faisceaux, pour dessiner et
 * vérifier la carte du joueur. Module pur (sans React ni réseau). Les étages sont générés et arbitrés par le
 * serveur (backend/.../games/prismine/Engine.java, mêmes règles et même codage des cartes).
 */

/** Couleur d'un prisme. La lumière d'un faisceau mélange (OU binaire) ces couleurs ; 0 = blanc. */
export const RED = 1
export const GREEN = 2
export const BLUE = 4
export type PrismColor = typeof RED | typeof GREEN | typeof BLUE
export type Light = number

/** Coin de l'angle droit d'un prisme triangulaire, dans le sens horaire : ◢ ◣ ◤ ◥. */
export const SE = 0
export const SW = 1
export const NW = 2
export const NE = 3
export type Corner = typeof SE | typeof SW | typeof NW | typeof NE
export const CORNERS: Corner[] = [SE, SW, NW, NE]

export type Prism = { color: PrismColor; corner: Corner }

type PrismChar = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h' | 'i' | 'j' | 'k' | 'l'

/** Contenu d'une case : vide, prisme coloré (dévie et teinte la lumière), obsidienne (absorbe la lumière). */
export type Piece = '.' | '#' | PrismChar

/** Une lettre par prisme : les 4 coins du rouge, puis du vert, puis du bleu. */
const PRISM_CHARS = 'abcdefghijkl'
const PRISM_COLORS: PrismColor[] = [RED, GREEN, BLUE]

/** Carte valide, caractère par caractère. */
export const GRID_PATTERN = /^[.#a-l]*$/

/** Carte d'une galerie : taille × taille cases lues ligne par ligne, une `Piece` par caractère. */
export type Grid = string

/**
 * Résultat d'un tir : entrée par laquelle le faisceau ressort (null s'il est absorbé), nombre de rebonds
 * et couleur finale (mélange des couleurs des prismes touchés).
 */
export type Outcome = { exit: number | null; bounces: number; color: Light }

/**
 * Trajet d'un faisceau, pour le dessiner : point de départ (hors galerie), cases où il tourne,
 * puis point de sortie (hors galerie) ou case d'obsidienne qui l'absorbe.
 * Coordonnées en cases : -1 et `size` désignent le bord. `colors[i]` : couleur du faisceau après `path[i]`.
 */
export type Trace = Outcome & { path: [row: number, col: number][]; colors: Light[] }

export function prism(color: PrismColor, corner: Corner): Piece {
  return PRISM_CHARS[PRISM_COLORS.indexOf(color) * 4 + corner] as PrismChar
}

export function prismOf(piece: Piece): Prism | null {
  const index = piece.length === 1 ? PRISM_CHARS.indexOf(piece) : -1
  if (index < 0) return null
  return { color: PRISM_COLORS[Math.floor(index / 4)], corner: (index % 4) as Corner }
}

export function emptyGrid(size: number): Grid {
  return '.'.repeat(size * size)
}

export function withPiece(grid: Grid, cell: number, piece: Piece): Grid {
  return grid.slice(0, cell) + piece + grid.slice(cell + 1)
}

export function countPieces(grid: Grid) {
  let prisms = 0
  let obsidians = 0
  for (const piece of grid) {
    if (piece === '#') obsidians++
    else if (piece !== '.') prisms++
  }
  return { prisms, obsidians }
}

/**
 * Ordre de pose au clic, dans la couleur choisie : vide → ◢ → ◣ → ◤ → ◥ → obsidienne (seulement si
 * l'étage en cache) → vide. Un prisme d'une autre couleur est d'abord repeint, sans tourner.
 */
export function nextPiece(piece: Piece, color: PrismColor, withObsidian: boolean, backwards = false): Piece {
  const current = prismOf(piece)
  if (current && current.color !== color) return prism(color, current.corner)
  const order: Piece[] = ['.', ...CORNERS.map((corner) => prism(color, corner))]
  if (withObsidian) order.push('#')
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
  const colors: Light[] = [0]
  let bounces = 0
  let color: Light = 0
  // Un prisme envoie les 4 directions d'arrivée vers 4 directions de départ distinctes : un trajet est
  // réversible, il ne peut pas boucler et finit toujours par ressortir ou être absorbé.
  // La borne (case × direction) n'est qu'un garde-fou.
  for (let step = 0; step <= 4 * size * size; step++) {
    row += DR[dir]
    col += DC[dir]
    if (row < 0 || col < 0 || row >= size || col >= size) {
      path.push([row, col])
      colors.push(color)
      return { exit: entryAt(row, col, size), bounces, color, path, colors }
    }
    const piece = grid[row * size + col] as Piece
    if (piece === '#') {
      path.push([row, col])
      colors.push(color)
      return { exit: null, bounces, color, path, colors }
    }
    const found = prismOf(piece)
    if (found) {
      dir = deflect(found.corner, dir)
      color |= found.color
      bounces++
      path.push([row, col])
      colors.push(color)
    }
  }
  return { exit: null, bounces, color, path, colors }
}

/**
 * Direction de sortie d'un faisceau qui entre dans un prisme. Les côtés plats (ceux de l'angle droit)
 * le renvoient d'où il vient ; l'hypoténuse le dévie d'un quart de tour, comme un miroir « / » pour ◢ et ◤
 * (nord ↔ est, sud ↔ ouest) ou « \ » pour ◣ et ◥ (nord ↔ ouest, sud ↔ est).
 */
function deflect(corner: Corner, dir: number): number {
  const side = (dir + 2) % 4 // côté de la case par lequel le faisceau entre
  if (side === (corner + 1) % 4 || side === (corner + 2) % 4) return side
  return corner % 2 === 0 ? dir ^ 1 : 3 - dir
}

export function sameOutcome(a: Outcome, b: Outcome) {
  return a.exit === b.exit && a.bounces === b.bounces && a.color === b.color
}
