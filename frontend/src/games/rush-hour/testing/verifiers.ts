import { ApiError } from '@/lib/api'
import { parseBoard } from '../domain/board'
import { getLevel } from '../domain/levels'
import { levelScore } from '../domain/score'
import { solve } from '../domain/solver'
import type { LevelVerifier } from '../services/levelVerifier'

/** Stub : le serveur renvoie ce score, quels que soient les coups. */
export function verifyAs(score: number): LevelVerifier {
  return async (_level, run) => ({ score, moves: run.moves.length, optimal: run.moves.length })
}

/** Stub : le serveur refuse la partie (422), comme pour des coups truqués. */
export function refuseWith(message: string): LevelVerifier {
  return async () => {
    throw new ApiError(422, message)
  }
}

/** Fake : calcule le score avec le barème du front, pour un niveau dont le minimum est `optimal`. */
export function scoreWithOptimal(optimal: number): LevelVerifier {
  return async (_level, run) => ({
    score: levelScore({ moves: run.moves.length, optimal, hintsUsed: run.hintsUsed }),
    moves: run.moves.length,
    optimal,
  })
}

/** Fake : comme le serveur, avec les vrais niveaux (minimum calculé par le solveur du front). */
export const levelsVerifier: LevelVerifier = (level, run) =>
  scoreWithOptimal(solve(parseBoard(getLevel(level).map))!.length)(level, run)
