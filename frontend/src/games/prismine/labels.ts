import { cellName, entryName, prismOf, type Grid, type Light, type Outcome, type Piece } from './engine'

/** Nom d'une lumière, indexé par son mélange de couleurs (rouge = 1, vert = 2, bleu = 4). */
const LIGHT_NAMES = ['blanc', 'rouge', 'vert', 'jaune', 'bleu', 'magenta', 'cyan', 'irisé']

/** Position de l'angle droit, indexée par `Corner` (◢ ◣ ◤ ◥). */
const CORNER_NAMES = [
  'angle en bas à droite',
  'angle en bas à gauche',
  'angle en haut à gauche',
  'angle en haut à droite',
]

export function lightName(color: Light) {
  return LIGHT_NAMES[color]
}

export function pieceName(piece: Piece) {
  if (piece === '.') return 'vide'
  if (piece === '#') return 'obsidienne'
  const { color, corner } = prismOf(piece)!
  return `prisme ${lightName(color)}, ${CORNER_NAMES[corner]}`
}

export function plural(count: number, singular: string, pluralForm = `${singular}s`) {
  return `${count} ${count > 1 ? pluralForm : singular}`
}

/** « sortie Bas C, jaune, après 2 rebonds », « absorbé, blanc, sans rebond »… */
export function outcomeText({ exit, bounces, color }: Outcome, size: number) {
  const where = exit === null ? 'absorbé' : `sortie ${entryName(exit, size)}`
  return `${where}, ${lightName(color)}, ${bounces === 0 ? 'sans rebond' : `après ${plural(bounces, 'rebond')}`}`
}

/** Position des pièces d'une carte, pour les lecteurs d'écran (« Prismes : B2 rouge, angle en bas à droite. »). */
export function solutionText(grid: Grid, size: number) {
  const prisms: string[] = []
  const obsidians: string[] = []
  for (let cell = 0; cell < grid.length; cell++) {
    const piece = grid[cell] as Piece
    if (piece === '#') obsidians.push(cellName(cell, size))
    else if (piece !== '.') prisms.push(`${cellName(cell, size)} ${pieceName(piece).replace('prisme ', '')}`)
  }
  const parts = [`Prismes : ${prisms.join(' ; ')}.`]
  if (obsidians.length > 0) parts.push(`Obsidienne : ${obsidians.join(', ')}.`)
  return parts.join(' ')
}
