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
/** La voiture à faire sortir. */
export const RED_CAR = 'X'
/** Ligne de la sortie (0 = la 1ʳᵉ ligne) : la voiture rouge sort par le bord droit de cette ligne. */
export const EXIT_ROW = 2

type Cell = { row: number; col: number }

/** Lit une map (6 lignes de 6 cases) : '.' = vide, chaque lettre majuscule = les cases d'un véhicule. */
export function parseBoard(map: string[]): Board {
  if (map.length !== SIZE || map.some((line) => line.length !== SIZE)) {
    throw new Error(`Le plateau doit faire ${SIZE} lignes de ${SIZE} cases`)
  }

  const cellsById = new Map<string, Cell[]>()
  map.forEach((line, row) => {
    ;[...line].forEach((id, col) => {
      if (id === '.') return
      if (!/^[A-Z]$/.test(id)) throw new Error(`Caractère interdit : ${id}`)
      cellsById.set(id, [...(cellsById.get(id) ?? []), { row, col }])
    })
  })

  const vehicles = [...cellsById].map(([id, cells]) => toVehicle(id, cells))
  const red = vehicles.find((v) => v.id === RED_CAR)
  if (red?.orientation !== 'H' || red.row !== EXIT_ROW) {
    throw new Error(`La voiture rouge ${RED_CAR} doit être horizontale, sur la ${EXIT_ROW + 1}ᵉ ligne`)
  }
  return { vehicles }
}

/** Un véhicule : 2 ou 3 cases alignées et contiguës. */
function toVehicle(id: string, cells: Cell[]): Vehicle {
  if (cells.length < 2 || cells.length > 3) throw new Error(`Le véhicule ${id} doit mesurer 2 ou 3 cases`)

  const [first] = cells
  const orientation: Orientation = cells.every((c) => c.row === first.row) ? 'H' : 'V'
  const continuous = cells.every((c, i) =>
    orientation === 'H'
      ? c.row === first.row && c.col === first.col + i
      : c.col === first.col && c.row === first.row + i,
  )
  if (!continuous) throw new Error(`Le véhicule ${id} doit être d’un seul tenant`)

  return { id, orientation, row: first.row, col: first.col, length: cells.length }
}

/** Un coup : glisser le véhicule `id` de `delta` cases (négatif = gauche ou haut). */
export interface Move {
  id: string
  delta: number
}
