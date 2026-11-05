// Fuzzing de parseBoard avec fast-check : des centaines de grilles tirées au hasard, valides ou non. Le parseur doit
// accepter un plateau conforme aux règles, ou le refuser avec un des messages prévus, sans jamais planter autrement.
// En cas d'échec, fast-check réduit la grille au plus petit contre-exemple et affiche sa graine.
import fc from 'fast-check'
import { describe, expect, test } from 'vitest'
import { type Board, EXIT_ROW, parseBoard, RED_CAR, SIZE } from './board'

// Un plateau valide construit au hasard : la voiture rouge sur sa ligne, puis des véhicules posés là où il y a la place.
const placement = fc.record({
  horizontal: fc.boolean(),
  length: fc.constantFrom(2, 3),
  row: fc.integer({ min: 0, max: SIZE - 1 }),
  col: fc.integer({ min: 0, max: SIZE - 1 }),
})
const validGrid = fc
  .record({ red: fc.integer({ min: 0, max: SIZE - 2 }), others: fc.array(placement, { maxLength: 12 }) })
  .map(({ red, others }) => {
    const cells = Array.from({ length: SIZE }, () => Array<string>(SIZE).fill('.'))
    cells[EXIT_ROW][red] = cells[EXIT_ROW][red + 1] = RED_CAR
    const ids = 'ABCDEFGHIJKLMNOP'
    others.forEach(({ horizontal, length, row, col }, i) => {
      const spots = Array.from({ length }, (_, k) => (horizontal ? [row, col + k] : [row + k, col]))
      if (spots.every(([r, c]) => r < SIZE && c < SIZE && cells[r][c] === '.'))
        for (const [r, c] of spots) cells[r][c] = ids[i]
    })
    return cells.map((line) => line.join(''))
  })

// La même chose, abîmée : une case remplacée (lettre, caractère interdit), ou une ligne en trop ou en moins.
const damage = fc.oneof(
  fc.record({
    row: fc.integer({ min: 0, max: SIZE - 1 }),
    col: fc.integer({ min: 0, max: SIZE - 1 }),
    char: fc.constantFrom('.', 'X', 'A', 'B', 'a', '#', '1', 'é', ' '),
  }),
  fc.constantFrom('ligne en trop', 'ligne en moins', 'case en trop'),
)
const damagedGrid = fc.tuple(validGrid, damage).map(([map, d]) => {
  if (d === 'ligne en trop') return [...map, '......']
  if (d === 'ligne en moins') return map.slice(1)
  if (d === 'case en trop') return [map[0] + '.', ...map.slice(1)]
  const line = [...map[d.row]]
  line[d.col] = d.char
  return map.map((l, r) => (r === d.row ? line.join('') : l))
})

const grid = fc.oneof(validGrid, damagedGrid)

const EXPECTED_ERRORS = [
  /^Le plateau doit faire 6 lignes de 6 cases$/,
  /^Caractère interdit : .$/u,
  /^Le véhicule [A-Z] doit mesurer 2 ou 3 cases$/,
  /^Le véhicule [A-Z] doit être d’un seul tenant$/,
  /^La voiture rouge X doit être horizontale, sur la 3ᵉ ligne$/,
]

/** Redessine la grille à partir des véhicules lus. */
function draw(board: Board): string[] {
  const cells = Array.from({ length: SIZE }, () => Array<string>(SIZE).fill('.'))
  for (const v of board.vehicles)
    for (let i = 0; i < v.length; i++) {
      if (v.orientation === 'H') cells[v.row][v.col + i] = v.id
      else cells[v.row + i][v.col] = v.id
    }
  return cells.map((line) => line.join(''))
}

describe('parseBoard (propriétés)', () => {
  test('n’importe quelle grille est acceptée ou refusée avec un message prévu, sans autre erreur', () => {
    fc.assert(
      fc.property(grid, (map) => {
        // Act
        let error: unknown = null
        try {
          parseBoard(map)
        } catch (e) {
          error = e
        }

        // Assert
        if (error !== null) {
          expect(error).toBeInstanceOf(Error)
          expect(EXPECTED_ERRORS.some((re) => re.test((error as Error).message))).toBe(true)
        }
      }),
      { numRuns: 500 },
    )
  })

  test('aller-retour : un plateau accepté, redessiné à partir de ses véhicules, redonne la même grille', () => {
    fc.assert(
      fc.property(grid, (map) => {
        // Arrange : on ne garde que les grilles acceptées
        let board
        try {
          board = parseBoard(map)
        } catch {
          return
        }

        // Act
        const redrawn = draw(board)

        // Assert
        expect(redrawn).toEqual(map)
      }),
      { numRuns: 500 },
    )
  })

  test('un plateau accepté respecte les règles : véhicules de 2 ou 3 cases, dans la grille, sans chevauchement', () => {
    fc.assert(
      fc.property(grid, (map) => {
        // Arrange : on ne garde que les grilles acceptées
        let board
        try {
          board = parseBoard(map)
        } catch {
          return
        }

        // Assert
        const taken = new Set<string>()
        for (const v of board.vehicles) {
          expect([2, 3]).toContain(v.length)
          for (let i = 0; i < v.length; i++) {
            const [row, col] = v.orientation === 'H' ? [v.row, v.col + i] : [v.row + i, v.col]
            expect(row).toBeGreaterThanOrEqual(0)
            expect(row).toBeLessThan(SIZE)
            expect(col).toBeGreaterThanOrEqual(0)
            expect(col).toBeLessThan(SIZE)
            expect(taken.has(`${row},${col}`)).toBe(false)
            taken.add(`${row},${col}`)
          }
        }
        expect(board.vehicles.find((v) => v.id === RED_CAR)).toMatchObject({ orientation: 'H', row: EXIT_ROW })
      }),
      { numRuns: 500 },
    )
  })
})
