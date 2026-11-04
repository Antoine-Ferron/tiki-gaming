import { describe, expect, it, vi } from 'vitest'
import {
  FLEET,
  GRID_SIZE,
  canPlaceShip,
  computeScore,
  computeUnlocks,
  coordKey,
  fireAndSubmitIfOver,
  fireShot,
  fireVolley,
  fireVolleyAndSubmitIfOver,
  isFleetSunk,
  isInBounds,
  placeFleetRandomly,
  scanZone,
  shipCoords,
  sunkShips,
  zoneCoords,
  type PlacedShip,
} from './logic'

/** Stub déterministe : rejoue la séquence de valeurs fournie au lieu de Math.random. */
function stubRandom(values: number[]): () => number {
  let i = 0
  return () => values[i++]
}

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

describe('placeFleetRandomly (stub déterministe)', () => {
  it('place la flotte exactement comme le dicte la source aléatoire injectée', () => {
    // Chaque navire tire : orientation (< 0.5 = horizontal), ligne, colonne.
    // Une ligne distincte par navire, colonne 0 : aucun chevauchement, donc un seul tirage par navire.
    const random = stubRandom([0, 0, 0, 0, 0.1, 0, 0, 0.2, 0, 0, 0.3, 0, 0, 0.4, 0])

    const fleet = placeFleetRandomly(random)

    expect(fleet).toEqual([
      { ship: FLEET[0], coords: shipCoords({ row: 0, col: 0 }, FLEET[0].size, 'horizontal') },
      { ship: FLEET[1], coords: shipCoords({ row: 1, col: 0 }, FLEET[1].size, 'horizontal') },
      { ship: FLEET[2], coords: shipCoords({ row: 2, col: 0 }, FLEET[2].size, 'horizontal') },
      { ship: FLEET[3], coords: shipCoords({ row: 3, col: 0 }, FLEET[3].size, 'horizontal') },
      { ship: FLEET[4], coords: shipCoords({ row: 4, col: 0 }, FLEET[4].size, 'horizontal') },
    ])
  })

  it('retire une nouvelle position quand le tirage propose un chevauchement', () => {
    // Porte-avions (5) en ligne 0 colonne 0. Puis le Croiseur (4) tire d'abord ligne 0 colonne 0
    // (chevauchement, rejeté) avant de retirer ligne 1 colonne 0 (valide). Les navires suivants
    // reçoivent chacun un tirage valide du premier coup, sur une ligne distincte.
    const random = stubRandom([0, 0, 0, 0, 0, 0, 0, 0.1, 0, 0, 0.2, 0, 0, 0.3, 0, 0, 0.4, 0])

    const fleet = placeFleetRandomly(random)

    expect(fleet[0].coords).toEqual(shipCoords({ row: 0, col: 0 }, FLEET[0].size, 'horizontal'))
    expect(fleet[1].coords).toEqual(shipCoords({ row: 1, col: 0 }, FLEET[1].size, 'horizontal'))
  })
})

describe('fireAndSubmitIfOver', () => {
  it('soumet le score une seule fois quand le tir coule le dernier navire', async () => {
    const fleet = buildFleetAt({ row: 0, col: 0 }) // Torpilleur, taille 2 : (0,0) et (0,1)
    const shots = new Set([coordKey({ row: 0, col: 0 })])
    const submitScore = vi.fn().mockResolvedValue(true)

    const outcome = await fireAndSubmitIfOver(fleet, shots, { row: 0, col: 1 }, submitScore)

    expect(outcome.gameOver).toBe(true)
    expect(submitScore).toHaveBeenCalledTimes(1)
    expect(submitScore).toHaveBeenCalledWith(computeScore(2, 2), { shots: 2, hits: 2 })
  })

  it("ne soumet aucun score tant que la flotte adverse n'est pas entièrement coulée", async () => {
    const fleet = buildFleetAt({ row: 0, col: 0 })
    const shots = new Set<string>()
    const submitScore = vi.fn().mockResolvedValue(true)

    const outcome = await fireAndSubmitIfOver(fleet, shots, { row: 0, col: 0 }, submitScore)

    expect(outcome.gameOver).toBe(false)
    expect(submitScore).not.toHaveBeenCalled()
  })

  it('ne soumet pas de nouveau score sur un tir répété après la victoire', async () => {
    const fleet = buildFleetAt({ row: 0, col: 0 })
    const shots = new Set(fleet.flatMap((p) => p.coords.map(coordKey)))
    const submitScore = vi.fn().mockResolvedValue(true)

    const outcome = await fireAndSubmitIfOver(fleet, shots, { row: 0, col: 0 }, submitScore)

    expect(outcome.result).toBe('repeat')
    expect(submitScore).not.toHaveBeenCalled()
  })
})

describe('zoneCoords', () => {
  it('builds a 3x3 block centered on the given cell', () => {
    expect(zoneCoords({ row: 5, col: 5 })).toHaveLength(9)
    expect(zoneCoords({ row: 5, col: 5 })).toContainEqual({ row: 4, col: 4 })
    expect(zoneCoords({ row: 5, col: 5 })).toContainEqual({ row: 6, col: 6 })
  })

  it('clips the block to the grid near an edge or corner', () => {
    expect(zoneCoords({ row: 0, col: 0 })).toHaveLength(4)
    expect(zoneCoords({ row: 0, col: 5 })).toHaveLength(6)
  })
})

describe('scanZone', () => {
  it('reports occupied cells within the zone without marking them as shot', () => {
    const fleet = buildFleetAt({ row: 0, col: 0 }) // (0,0) et (0,1)
    const zone = zoneCoords({ row: 0, col: 0 })
    expect(scanZone(fleet, zone).map(coordKey).sort()).toEqual(['0,0', '0,1'])
  })

  it('reports no occupied cell when the zone misses every ship', () => {
    const fleet = buildFleetAt({ row: 0, col: 0 })
    expect(scanZone(fleet, zoneCoords({ row: 9, col: 9 }))).toEqual([])
  })
})

describe('fireVolley', () => {
  it('fires every target in order and reports a result for each', () => {
    const fleet = buildFleetAt({ row: 0, col: 0 }) // (0,0) et (0,1)
    const shots = new Set<string>()
    const outcomes = fireVolley(fleet, shots, [
      { row: 0, col: 0 },
      { row: 5, col: 5 },
      { row: 0, col: 1 },
    ])
    expect(outcomes.map((o) => o.result)).toEqual(['hit', 'miss', 'hit'])
    expect(outcomes[2].sunk).toEqual(fleet[0].ship)
  })

  it('reports repeat for a cell already targeted earlier in the same volley', () => {
    const fleet = buildFleetAt({ row: 0, col: 0 })
    const shots = new Set<string>()
    const outcomes = fireVolley(fleet, shots, [
      { row: 0, col: 0 },
      { row: 0, col: 0 },
    ])
    expect(outcomes.map((o) => o.result)).toEqual(['hit', 'repeat'])
  })
})

describe('sunkShips', () => {
  it('lists only the ships whose every cell has been hit', () => {
    const fleet = placeFleetRandomly(stubRandom([0, 0, 0, 0, 0.1, 0, 0, 0.2, 0, 0, 0.3, 0, 0, 0.4, 0]))
    const shots = new Set(fleet[0].coords.map(coordKey))
    expect(sunkShips(fleet, shots)).toEqual([fleet[0].ship])
  })

  it('is empty when no ship is fully hit', () => {
    const fleet = buildFleetAt({ row: 0, col: 0 })
    expect(sunkShips(fleet, new Set([coordKey({ row: 0, col: 0 })]))).toEqual([])
  })
})

describe('computeUnlocks', () => {
  it('unlocks nothing early in the game', () => {
    expect(computeUnlocks(0, 0)).toEqual({ salvo: false, radar: false, nuke: false })
  })

  it('unlocks salvo once a ship is sunk, independently of shot count', () => {
    expect(computeUnlocks(0, 1)).toEqual({ salvo: true, radar: false, nuke: false })
  })

  it('unlocks radar then nuke as shots accumulate', () => {
    expect(computeUnlocks(5, 0)).toEqual({ salvo: false, radar: true, nuke: false })
    expect(computeUnlocks(10, 0)).toEqual({ salvo: false, radar: true, nuke: true })
  })
})

describe('fireVolleyAndSubmitIfOver', () => {
  it('soumet le score une seule fois quand la volée coule le dernier navire', async () => {
    const fleet = buildFleetAt({ row: 0, col: 0 }) // Torpilleur, taille 2 : (0,0) et (0,1)
    const shots = new Set<string>()
    const submitScore = vi.fn().mockResolvedValue(true)

    const { outcomes, gameOver } = await fireVolleyAndSubmitIfOver(
      fleet,
      shots,
      [{ row: 0, col: 0 }, { row: 0, col: 1 }],
      submitScore,
    )

    expect(outcomes.map((o) => o.result)).toEqual(['hit', 'hit'])
    expect(gameOver).toBe(true)
    expect(submitScore).toHaveBeenCalledTimes(1)
    expect(submitScore).toHaveBeenCalledWith(computeScore(2, 2), { shots: 2, hits: 2 })
  })

  it("ne soumet aucun score tant que la flotte adverse n'est pas entièrement coulée", async () => {
    const fleet = buildFleetAt({ row: 0, col: 0 })
    const shots = new Set<string>()
    const submitScore = vi.fn().mockResolvedValue(true)

    const { gameOver } = await fireVolleyAndSubmitIfOver(fleet, shots, [{ row: 0, col: 0 }], submitScore)

    expect(gameOver).toBe(false)
    expect(submitScore).not.toHaveBeenCalled()
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
