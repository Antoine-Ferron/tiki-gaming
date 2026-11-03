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

/** Lit une map (6 lignes de 6 cases) : '.' = vide, chaque lettre = les cases d'un véhicule. */
export function parseBoard(map: string[]): Board {
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
