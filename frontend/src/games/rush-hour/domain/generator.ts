import { RED_CAR, SIZE, type Vehicle, parseBoard } from './board'
import { DIFFICULTY_RANGES, type Difficulty } from './difficulty'
import { GENERATOR_LAYOUTS } from './generatorLayouts'
import { axisPosition, nextPositions } from './solver'

/**
 * Plateau tiré au hasard, de la difficulté demandée : une disposition de la réserve, puis une position de départ
 * choisie parmi celles dont le minimum de coups est dans la plage. Le hasard est injecté (graine fixe en test).
 */
export function generateBoard(difficulty: Difficulty, random: () => number): string[] {
  const { min, max } = DIFFICULTY_RANGES[difficulty]
  const { vehicles, positions } = positionsOf(Math.floor(random() * GENERATOR_LAYOUTS.length))
  const candidates = positions.filter((p) => p.distance >= min && p.distance <= max)
  return toMap(vehicles, candidates[Math.floor(random() * candidates.length)].state)
}

type Positions = { vehicles: Vehicle[]; positions: { state: number[]; distance: number }[] }

/** Positions d'une disposition, calculées une seule fois puis gardées en mémoire (elles ne changent jamais). */
const cache = new Map<number, Positions>()

function positionsOf(layoutIndex: number): Positions {
  let found = cache.get(layoutIndex)
  if (!found) {
    const { vehicles } = parseBoard(GENERATOR_LAYOUTS[layoutIndex])
    found = { vehicles, positions: distancesToWin(vehicles) }
    cache.set(layoutIndex, found)
  }
  return found
}

/** Toutes les positions atteignables de la disposition, avec leur distance à la victoire (minimum de coups). */
function distancesToWin(vehicles: Vehicle[]): { state: number[]; distance: number }[] {
  const reachable = explore(vehicles, [vehicles.map(axisPosition)])
  const red = vehicles.findIndex((v) => v.id === RED_CAR)
  const goal = SIZE - vehicles[red].length
  const solved = [...reachable.values()].filter((state) => state[red] === goal)

  // Parcours en largeur en partant de toutes les positions gagnées à la fois.
  const result = solved.map((state) => ({ state, distance: 0 }))
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
        result.push({ state: moved, distance })
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
