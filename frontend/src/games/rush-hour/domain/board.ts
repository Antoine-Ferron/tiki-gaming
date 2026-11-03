export type Orientation = 'H' | 'V'

export interface Vehicle {
  id: string
  orientation: Orientation
  row: number
  col: number
  length: number
}

export interface Board {
  vehicles: Vehicle[]
}

/** Le plateau fait SIZE × SIZE cases. */
export const SIZE = 6

/** Lit une map (6 lignes de 6 cases) : '.' = vide, chaque lettre = les cases d'un véhicule. */
export function parseBoard(map: string[]): Board {
  if (map.length !== SIZE || map.some((line) => line.length !== SIZE)) {
    throw new Error(`Le plateau doit faire ${SIZE} lignes de ${SIZE} cases`)
  }
  const cellsById = new Map<string, { row: number; col: number }[]>()
  map.forEach((line, row) => {
    ;[...line].forEach((id, col) => {
      if (id === '.') return
      cellsById.set(id, [...(cellsById.get(id) ?? []), { row, col }])
    })
  })

  const vehicles = [...cellsById].map(([id, cells]) => {
    const [first] = cells
    const orientation: Orientation = cells.every((c) => c.row === first.row) ? 'H' : 'V'
    return { id, orientation, row: first.row, col: first.col, length: cells.length }
  })
  return { vehicles }
}

/** Un coup : glisser le véhicule `id` de `delta` cases (négatif = gauche ou haut). */
export interface Move {
  id: string
  delta: number
}
