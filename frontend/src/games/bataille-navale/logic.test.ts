import { describe, expect, it } from 'vitest'
import {
  FLEET,
  GRID_SIZE,
  canPlaceShip,
  computeScore,
  coordKey,
  fireShot,
  isFleetSunk,
  isInBounds,
  placeFleetRandomly,
  shipCoords,
  type PlacedShip,
} from './logic'

describe('isInBounds', () => {
  it('accepts coordinates inside the grid', () => {
    expect(isInBounds({ row: 0, col: 0 })).toBe(true)
    expect(isInBounds({ row: GRID_SIZE - 1, col: GRID_SIZE - 1 })).toBe(true)
  })

  it('rejects coordinates outside the grid', () => {
    expect(isInBounds({ row: -1, col: 0 })).toBe(false)
    expect(isInBounds({ row: 0, col: GRID_SIZE })).toBe(false)
  })
})

describe('shipCoords', () => {
  it('builds horizontal coordinates from the start cell', () => {
    expect(shipCoords({ row: 2, col: 3 }, 3, 'horizontal')).toEqual([
      { row: 2, col: 3 },
      { row: 2, col: 4 },
      { row: 2, col: 5 },
    ])
  })

  it('builds vertical coordinates from the start cell', () => {
    expect(shipCoords({ row: 2, col: 3 }, 3, 'vertical')).toEqual([
      { row: 2, col: 3 },
      { row: 3, col: 3 },
      { row: 4, col: 3 },
    ])
  })
})

describe('canPlaceShip', () => {
  it('refuses a placement that goes out of bounds', () => {
    const coords = shipCoords({ row: 0, col: GRID_SIZE - 2 }, 3, 'horizontal')
    expect(canPlaceShip([], coords)).toBe(false)
  })

  it('refuses a placement overlapping an existing ship', () => {
    const existing: PlacedShip[] = [{ ship: FLEET[0], coords: shipCoords({ row: 0, col: 0 }, 5, 'horizontal') }]
    const overlapping = shipCoords({ row: 0, col: 2 }, 3, 'vertical')
    expect(canPlaceShip(existing, overlapping)).toBe(false)
  })

  it('accepts a valid, non-overlapping, in-bounds placement', () => {
    const existing: PlacedShip[] = [{ ship: FLEET[0], coords: shipCoords({ row: 0, col: 0 }, 5, 'horizontal') }]
    const free = shipCoords({ row: 5, col: 0 }, 3, 'horizontal')
    expect(canPlaceShip(existing, free)).toBe(true)
  })
})

function buildFleetAt(start: { row: number; col: number }): PlacedShip[] {
  return [{ ship: FLEET[FLEET.length - 1], coords: shipCoords(start, FLEET[FLEET.length - 1].size, 'horizontal') }]
}

describe('fireShot', () => {
  it('reports a miss when no ship occupies the target', () => {
    const fleet = buildFleetAt({ row: 0, col: 0 })
    const shots = new Set<string>()
    expect(fireShot(fleet, shots, { row: 5, col: 5 }).result).toBe('miss')
  })

  it('reports a hit when a ship occupies the target', () => {
    const fleet = buildFleetAt({ row: 0, col: 0 })
    const shots = new Set<string>()
    expect(fireShot(fleet, shots, { row: 0, col: 0 }).result).toBe('hit')
  })

  it('reports repeat when the same cell is targeted twice', () => {
    const fleet = buildFleetAt({ row: 0, col: 0 })
    const shots = new Set<string>()
    fireShot(fleet, shots, { row: 0, col: 0 })
    expect(fireShot(fleet, shots, { row: 0, col: 0 }).result).toBe('repeat')
  })

  it('reports the sunk ship once every one of its cells is hit', () => {
    const fleet = buildFleetAt({ row: 0, col: 0 }) // size 2: (0,0) and (0,1)
    const shots = new Set<string>()
    expect(fireShot(fleet, shots, { row: 0, col: 0 }).sunk).toBeUndefined()
    expect(fireShot(fleet, shots, { row: 0, col: 1 }).sunk).toEqual(fleet[0].ship)
  })
})

describe('isFleetSunk', () => {
  it('is false while a ship still has an unhit cell', () => {
    const fleet = buildFleetAt({ row: 0, col: 0 })
    const shots = new Set([coordKey({ row: 0, col: 0 })])
    expect(isFleetSunk(fleet, shots)).toBe(false)
  })

  it('is true once every ship cell has been hit', () => {
    const fleet = buildFleetAt({ row: 0, col: 0 })
    const shots = new Set(fleet.flatMap((p) => p.coords.map(coordKey)))
    expect(isFleetSunk(fleet, shots)).toBe(true)
  })
})

describe('placeFleetRandomly', () => {
  it('places every ship of the fleet without overlap and in bounds', () => {
    const fleet = placeFleetRandomly()
    expect(fleet.map((p) => p.ship.name).sort()).toEqual(FLEET.map((s) => s.name).sort())

    const seen = new Set<string>()
    for (const placed of fleet) {
      expect(placed.coords).toHaveLength(placed.ship.size)
      for (const c of placed.coords) {
        expect(isInBounds(c)).toBe(true)
        const key = coordKey(c)
        expect(seen.has(key)).toBe(false)
        seen.add(key)
      }
    }
  })
})

describe('computeScore', () => {
  it('rewards fewer shots for the same number of hits', () => {
    expect(computeScore(20, 17)).toBeGreaterThan(computeScore(40, 17))
  })

  it('never drops below the minimum score', () => {
    expect(computeScore(1000, 0)).toBeGreaterThanOrEqual(10)
  })
})
