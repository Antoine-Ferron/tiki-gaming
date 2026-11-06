import fc from 'fast-check'
import { describe, expect, test } from 'vitest'
import { canMove, moveGrid, type Direction } from './board'
import { slideLine } from './line'
import { play, type GameState } from './game'
import { randomSpawner } from './spawner'

// Tests de propriétés (fuzzing) : fast-check génère des centaines de grilles au hasard et cherche un
// contre-exemple à chaque règle. S'il en trouve un, il le réduit au cas le plus simple avant de l'afficher.

const tile = fc.constantFrom(0, 0, 0, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048)
const line = fc.array(tile, { minLength: 4, maxLength: 4 })
const grid = fc.array(line, { minLength: 4, maxLength: 4 })
const direction = fc.constantFrom<Direction>('left', 'right', 'up', 'down')
/** Grille pleine, sans case vide : environ une sur dix est bloquée, assez pour tester F3. */
const fullGrid = fc.array(
  fc.array(fc.constantFrom(2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048), { minLength: 4, maxLength: 4 }),
  {
    minLength: 4,
    maxLength: 4,
  },
)

const sum = (cells: readonly number[]) => cells.reduce((a, b) => a + b, 0)
const tiles = (cells: readonly number[]) => cells.filter((value) => value !== 0)
const isPowerOfTwo = (value: number) => value >= 2 && (value & (value - 1)) === 0

describe('propriétés de slideLine', () => {
  test('conserve la somme des tuiles et les tasse contre le bord, sans trou', () => {
    fc.assert(
      fc.property(line, (before) => {
        const { line: after } = slideLine(before)
        const count = tiles(after).length
        expect(sum(after)).toBe(sum(before))
        expect(after.slice(0, count).every((value) => value !== 0)).toBe(true)
        expect(after.slice(count).every((value) => value === 0)).toBe(true)
      }),
    )
  })
})

describe('propriétés de moveGrid', () => {
  test('conserve la somme des tuiles, ne garde que des puissances de 2 et n’ajoute jamais de tuile', () => {
    fc.assert(
      fc.property(grid, direction, (before, dir) => {
        const { grid: after } = moveGrid(before, dir)
        expect(sum(after.flat())).toBe(sum(before.flat()))
        expect(tiles(after.flat()).every(isPowerOfTwo)).toBe(true)
        expect(tiles(after.flat()).length).toBeLessThanOrEqual(tiles(before.flat()).length)
      }),
    )
  })

  test('chaque fusion retire une tuile et rapporte au moins 4 points', () => {
    fc.assert(
      fc.property(grid, direction, (before, dir) => {
        const { grid: after, points } = moveGrid(before, dir)
        const merges = tiles(before.flat()).length - tiles(after.flat()).length
        expect(points >= 4 * merges).toBe(true)
        expect(points === 0).toBe(merges === 0)
      }),
    )
  })

  test('moved est faux exactement quand la grille ne change pas (R7)', () => {
    fc.assert(
      fc.property(grid, direction, (before, dir) => {
        const { grid: after, moved } = moveGrid(before, dir)
        expect(moved).toBe(JSON.stringify(after) !== JSON.stringify(before))
      }),
    )
  })

  test('rejouer la même direction sans nouvelle tuile ne bouge que s’il reste une fusion', () => {
    fc.assert(
      fc.property(grid, direction, (before, dir) => {
        const once = moveGrid(before, dir).grid
        const twice = moveGrid(once, dir)
        expect(twice.moved).toBe(twice.points > 0)
      }),
    )
  })

  test('une grille bloquée ne bouge dans aucune direction (F3)', () => {
    fc.assert(
      fc.property(fullGrid, (before) => {
        fc.pre(!canMove(before))
        for (const dir of ['left', 'right', 'up', 'down'] as const) expect(moveGrid(before, dir).moved).toBe(false)
      }),
    )
  })
})

describe('propriétés de play', () => {
  test('le score augmente exactement des points du coup, et un coup ajoute au plus une tuile', () => {
    const draws = fc.infiniteStream(fc.double({ min: 0, max: 0.999, noNaN: true }))
    fc.assert(
      fc.property(grid, direction, fc.nat(100_000), draws, (start, dir, score, stream) => {
        const game: GameState = { grid: start, score, moves: 0, status: 'playing', continued: false }
        const after = play(
          game,
          dir,
          randomSpawner(() => stream.next().value),
        )
        expect(after.score).toBe(score + moveGrid(start, dir).points)
        expect(tiles(after.grid.flat()).length).toBeLessThanOrEqual(tiles(start.flat()).length + 1)
      }),
    )
  })
})
