import { canMove, maxTile, moveGrid, type Direction } from './board'
import type { TileSpawner } from './spawner'

export const SIZE = 4
export const WINNING_TILE = 2048

export type GameStatus = 'playing' | 'won' | 'lost'

export interface GameState {
  grid: number[][]
  score: number
  moves: number
  status: GameStatus
  /** Le joueur a choisi de continuer après la victoire : il ne peut plus regagner (F2). */
  continued: boolean
}

export function newGame(spawner: TileSpawner): GameState {
  const empty = Array.from({ length: SIZE }, () => Array<number>(SIZE).fill(0))
  return { grid: spawner.spawn(spawner.spawn(empty)), score: 0, moves: 0, status: 'playing', continued: false }
}

export function play(game: GameState, direction: Direction, spawner: TileSpawner): GameState {
  if (game.status !== 'playing') return game
  const { grid, points, moved } = moveGrid(game.grid, direction)
  if (!moved) return game

  const next = spawner.spawn(grid)
  let status: GameStatus = 'playing'
  if (!game.continued && maxTile(next) >= WINNING_TILE) status = 'won'
  else if (!canMove(next)) status = 'lost'

  return { ...game, grid: next, score: game.score + points, moves: game.moves + 1, status }
}

export function keepPlaying(game: GameState): GameState {
  return { ...game, status: 'playing', continued: true }
}
