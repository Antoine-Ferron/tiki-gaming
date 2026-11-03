import { type Board, SIZE, type Vehicle } from './board'

/** Amplitude d'un glissement : min (≤ 0) vers la gauche ou le haut, max (≥ 0) vers la droite ou le bas. */
export interface MoveRange {
  min: number
  max: number
}

/** Jusqu'où un véhicule peut glisser dans son sens, sans sortir du plateau ni traverser un autre véhicule. */
export function moveRange(board: Board, id: string): MoveRange {
  const vehicle = board.vehicles.find((v) => v.id === id)
  if (!vehicle) throw new Error(`Véhicule inconnu : ${id}`)

  const occupied = new Set(board.vehicles.filter((v) => v !== vehicle).flatMap(cellsOf))
  const isFree = (offset: number) => {
    const { row, col } = cellAt(vehicle, offset)
    return row >= 0 && row < SIZE && col >= 0 && col < SIZE && !occupied.has(key(row, col))
  }

  let min = 0
  while (isFree(min - 1)) min--
  let max = 0
  while (isFree(vehicle.length + max)) max++
  return { min, max }
}

/** Fait glisser un véhicule de `delta` cases (un coup). Renvoie un nouveau plateau : l'original ne change pas. */
export function moveVehicle(board: Board, id: string, delta: number): Board {
  if (delta === 0) throw new Error('Déplacement nul')
  const { min, max } = moveRange(board, id)
  if (delta < min || delta > max) throw new Error(`Déplacement impossible : ${id} de ${delta}`)

  return {
    vehicles: board.vehicles.map((v) => {
      if (v.id !== id) return v
      const { row, col } = cellAt(v, delta)
      return { ...v, row, col }
    }),
  }
}

/** Case située à `offset` cases de l'avant-gauche (ou du haut) du véhicule, dans son sens. */
function cellAt(v: Vehicle, offset: number) {
  return v.orientation === 'H' ? { row: v.row, col: v.col + offset } : { row: v.row + offset, col: v.col }
}

function cellsOf(v: Vehicle): string[] {
  return Array.from({ length: v.length }, (_, i) => {
    const { row, col } = cellAt(v, i)
    return key(row, col)
  })
}

const key = (row: number, col: number) => `${row},${col}`
