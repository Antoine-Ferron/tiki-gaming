import { type Board, type Move, RED_CAR, SIZE, type Vehicle } from './board'
import { isSolved } from './moves'

/**
 * Solution la plus courte (parcours en largeur : on essaie tous les plateaux à 1 coup, puis à 2 coups…),
 * ou null si le plateau est impossible. Un coup = un glissement, quelle que soit la distance.
 *
 * Pour aller vite, un état n'est qu'un tableau de positions : la colonne d'un véhicule horizontal, la
 * ligne d'un véhicule vertical (l'autre coordonnée ne change jamais).
 */
export function solve(start: Board): Move[] | null {
  if (isSolved(start)) return []

  const { vehicles } = start
  const red = vehicles.findIndex((v) => v.id === RED_CAR)
  const goal = SIZE - vehicles[red].length
  const initial = vehicles.map(axisPosition)
  const parents = new Map<string, { from: string; move: Move } | null>([[initial.join(), null]])
  let frontier = [initial]

  while (frontier.length > 0) {
    const next: number[][] = []
    for (const state of frontier) {
      for (const { index, position } of nextPositions(vehicles, state)) {
        const moved = state.slice()
        moved[index] = position
        const key = moved.join()
        if (parents.has(key)) continue
        parents.set(key, { from: state.join(), move: { id: vehicles[index].id, delta: position - state[index] } })
        if (index === red && position === goal) return pathTo(parents, key)
        next.push(moved)
      }
    }
    frontier = next
  }
  return null
}

const axisPosition = (v: Vehicle) => (v.orientation === 'H' ? v.col : v.row)

/** Positions atteignables en un glissement depuis l'état, pour chaque véhicule. */
function* nextPositions(vehicles: Vehicle[], state: number[]) {
  const occupied = occupancy(vehicles, state)
  for (let index = 0; index < vehicles.length; index++) {
    const v = vehicles[index]
    const cell = (p: number) => (v.orientation === 'H' ? v.row * SIZE + p : p * SIZE + v.col)
    for (let p = state[index] - 1; p >= 0 && !occupied[cell(p)]; p--) yield { index, position: p }
    for (let p = state[index] + 1; p + v.length <= SIZE && !occupied[cell(p + v.length - 1)]; p++) {
      yield { index, position: p }
    }
  }
}

function occupancy(vehicles: Vehicle[], state: number[]) {
  const grid = new Uint8Array(SIZE * SIZE)
  vehicles.forEach((v, i) => {
    for (let k = 0; k < v.length; k++) {
      grid[v.orientation === 'H' ? v.row * SIZE + state[i] + k : (state[i] + k) * SIZE + v.col] = 1
    }
  })
  return grid
}

function pathTo(parents: Map<string, { from: string; move: Move } | null>, key: string): Move[] {
  const path: Move[] = []
  for (let link = parents.get(key); link; link = parents.get(link.from)) path.unshift(link.move)
  return path
}
