import { type Board, RED_CAR, SIZE, type Vehicle, parseBoard } from './board'
import { DIFFICULTY_RANGES, type Difficulty } from './difficulty'
import { GENERATOR_LAYOUTS } from './generatorLayouts'
import { axisPosition, nextPositions } from './solver'

/**
 * Plateau tiré au hasard, de la difficulté demandée : une disposition de la réserve, puis une position de départ
 * choisie parmi celles dont le minimum de coups est dans la plage. Le hasard est injecté (graine fixe en test).
 */
export function generateBoard(difficulty: Difficulty, random: () => number): string[] {
  const { min, max } = DIFFICULTY_RANGES[difficulty]
  const layout = parseBoard(GENERATOR_LAYOUTS[Math.floor(random() * GENERATOR_LAYOUTS.length)])
  const candidates = positionsWithin(layout, min, max)
  return toMap(layout.vehicles, candidates[Math.floor(random() * candidates.length)])
}

/** Toutes les positions atteignables depuis la disposition, dont la distance à la victoire est dans [min, max]. */
function positionsWithin(layout: Board, min: number, max: number): number[][] {
  const { vehicles } = layout
  const reachable = explore(vehicles, [vehicles.map(axisPosition)])
  const red = vehicles.findIndex((v) => v.id === RED_CAR)
  const goal = SIZE - vehicles[red].length
  const solved = [...reachable.values()].filter((state) => state[red] === goal)

  // Distance à la victoire : parcours en largeur en partant de toutes les positions gagnées à la fois.
  const result: number[][] = []
  const seen = new Set(solved.map((s) => s.join()))
  let frontier = solved
  for (let distance = 1; frontier.length > 0; distance++) {
    const next: number[][] = []
    for (const state of frontier) {
      for (const { index, position } of nextPositions(vehicles, state)) {
        const moved = state.slice()
        moved[index] = position
        if (seen.has(moved.join())) continue
        seen.add(moved.join())
        next.push(moved)
        if (distance >= min && distance <= max) result.push(moved)
      }
    }
    frontier = next
  }
  return result
}

/** Toutes les positions atteignables à partir des positions de départ données. */
function explore(vehicles: Vehicle[], starts: number[][]): Map<string, number[]> {
  const seen = new Map(starts.map((s) => [s.join(), s]))
  let frontier = starts
  while (frontier.length > 0) {
    const next: number[][] = []
    for (const state of frontier) {
      for (const { index, position } of nextPositions(vehicles, state)) {
        const moved = state.slice()
        moved[index] = position
        if (seen.has(moved.join())) continue
        seen.set(moved.join(), moved)
        next.push(moved)
      }
    }
    frontier = next
  }
  return seen
}

function toMap(vehicles: Vehicle[], state: number[]): string[] {
  const grid = Array.from({ length: SIZE }, () => Array<string>(SIZE).fill('.'))
  vehicles.forEach((v, i) => {
    for (let k = 0; k < v.length; k++) {
      if (v.orientation === 'H') grid[v.row][state[i] + k] = v.id
      else grid[state[i] + k][v.col] = v.id
    }
  })
  return grid.map((row) => row.join(''))
}
