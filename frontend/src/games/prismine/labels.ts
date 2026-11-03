import { cellName, entryName, type Grid, type Outcome, type Piece } from './engine'

export const PIECE_NAMES: Record<Piece, string> = {
  '.': 'vide',
  '/': 'cristal /',
  '\\': 'cristal \\',
  '#': 'obsidienne',
}

export function plural(count: number, singular: string, pluralForm = `${singular}s`) {
  return `${count} ${count > 1 ? pluralForm : singular}`
}

/** « sortie Bas C après 2 rebonds », « absorbé sans rebond »… */
export function outcomeText({ exit, bounces }: Outcome, size: number) {
  const where = exit === null ? 'absorbé' : `sortie ${entryName(exit, size)}`
  return `${where} ${bounces === 0 ? 'sans rebond' : `après ${plural(bounces, 'rebond')}`}`
}

/** Position des pièces d'une carte, pour les lecteurs d'écran (« Cristaux : B2 /, D5 \. »). */
export function solutionText(grid: Grid, size: number) {
  const crystals: string[] = []
  const obsidians: string[] = []
  for (let cell = 0; cell < grid.length; cell++) {
    const piece = grid[cell]
    if (piece === '#') obsidians.push(cellName(cell, size))
    else if (piece !== '.') crystals.push(`${cellName(cell, size)} ${piece}`)
  }
  const parts = [`Cristaux : ${crystals.join(', ')}`]
  if (obsidians.length > 0) parts.push(`obsidienne : ${obsidians.join(', ')}`)
  return `${parts.join(' ; ')}.`
}
