import { describe, expect, test, vi } from 'vitest'
import type { Grid } from './board'
import { keepPlaying, newGame, play, type GameState } from './game'
import type { TileSpawner } from './spawner'

/** Stub : pose toujours la même tuile sur la première case vide. */
function stubSpawner(value = 2): TileSpawner {
  return {
    spawn(grid) {
      const next = grid.map((row) => [...row])
      const r = next.findIndex((row) => row.includes(0))
      if (r >= 0) next[r][next[r].indexOf(0)] = value
      return next
    },
  }
}

function state(grid: Grid, overrides: Partial<GameState> = {}): GameState {
  return { grid: grid.map((row) => [...row]), score: 0, moves: 0, status: 'playing', continued: false, ...overrides }
}

describe('newGame', () => {
  test('commence avec une grille 4 × 4, deux tuiles et un score à 0', () => {
    // Arrange
    const spawner = stubSpawner()

    // Act
    const game = newGame(spawner)

    // Assert
    expect(game).toEqual({
      grid: [
        [2, 2, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ],
      score: 0,
      moves: 0,
      status: 'playing',
      continued: false,
    })
  })
})

describe('play', () => {
  test('un coup ajoute ses points au score, compte le coup et fait apparaître une tuile', () => {
    // Arrange
    const game = state(
      [
        [0, 0, 2, 2],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ],
      { score: 100, moves: 3 },
    )

    // Act
    const after = play(game, 'right', stubSpawner(4))

    // Assert
    expect(after).toEqual(
      state(
        [
          [4, 0, 0, 4],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
        ],
        { score: 104, moves: 4 },
      ),
    )
  })

  test('un coup qui ne bouge rien ne fait pas apparaître de tuile et ne compte pas (R7)', () => {
    // Arrange : spy sur le spawner
    const spawner = { spawn: vi.fn(stubSpawner().spawn) }
    const game = state([
      [2, 0, 0, 0],
      [4, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ])

    // Act
    const after = play(game, 'left', spawner)

    // Assert
    expect(spawner.spawn).not.toHaveBeenCalled()
    expect(after).toEqual(game)
  })

  test('un coup qui bouge fait apparaître exactement une tuile, après le glissement', () => {
    // Arrange : spy sur le spawner
    const spawner = { spawn: vi.fn(stubSpawner().spawn) }
    const game = state([
      [0, 0, 0, 2],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ])

    // Act
    play(game, 'left', spawner)

    // Assert
    expect(spawner.spawn).toHaveBeenCalledTimes(1)
    expect(spawner.spawn).toHaveBeenCalledWith([
      [2, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ])
  })

  test('créer la tuile 2048 fait gagner la partie (F1)', () => {
    // Arrange
    const game = state([
      [1024, 1024, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ])

    // Act
    const after = play(game, 'left', stubSpawner())

    // Assert
    expect(after.status).toBe('won')
    expect(after.score).toBe(2048)
  })

  test('une partie gagnée ne bouge plus tant que le joueur n’a pas choisi de continuer', () => {
    // Arrange
    const spawner = { spawn: vi.fn(stubSpawner().spawn) }
    const game = state(
      [
        [2048, 2, 2, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ],
      { status: 'won' },
    )

    // Act
    const after = play(game, 'left', spawner)

    // Assert
    expect(after).toEqual(game)
    expect(spawner.spawn).not.toHaveBeenCalled()
  })

  test('après avoir continué, une nouvelle tuile 2048 ne fait pas regagner (F2)', () => {
    // Arrange
    const game = keepPlaying(
      state(
        [
          [1024, 1024, 2048, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
        ],
        { status: 'won' },
      ),
    )

    // Act
    const after = play(game, 'left', stubSpawner())

    // Assert
    expect(game).toMatchObject({ status: 'playing', continued: true })
    expect(after.status).toBe('playing')
  })

  test.each([
    { tile: 4, status: 'lost' },
    { tile: 2, status: 'playing' },
  ] as const)('grille remplie par la nouvelle tuile ($tile) → $status (F3)', ({ tile, status }) => {
    // Arrange
    const game = state([
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [2, 4, 2, 0],
    ])

    // Act
    const after = play(game, 'right', stubSpawner(tile))

    // Assert
    expect(after.status).toBe(status)
  })

  test('une partie perdue ne bouge plus', () => {
    // Arrange
    const game = state(
      [
        [2, 4, 2, 4],
        [4, 2, 4, 2],
        [2, 4, 2, 4],
        [4, 2, 4, 2],
      ],
      { status: 'lost' },
    )

    // Act
    const after = play(game, 'up', stubSpawner())

    // Assert
    expect(after).toEqual(game)
  })
})
