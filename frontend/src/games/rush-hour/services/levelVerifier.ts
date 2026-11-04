import { apiPost } from '@/lib/api'
import type { Move } from '../domain/board'

/** Score vérifié par le serveur : il a rejoué les coups et calculé lui-même le score. */
export type VerifiedResult = { score: number; moves: number; optimal: number }

/** Port : vérifie une partie gagnée d'un niveau (le serveur en jeu, une doublure dans les tests). */
export type LevelVerifier = (level: number, run: { moves: Move[]; hintsUsed: number }) => Promise<VerifiedResult>

/** Adaptateur : le backend rejoue la partie (POST /api/games/rush-hour/levels/{niveau}/results). */
export const serverVerifier: LevelVerifier = (level, run) =>
  apiPost<VerifiedResult>(`/games/rush-hour/levels/${level}/results`, {
    moves: run.moves.map((m) => ({ vehicle: m.id, delta: m.delta })),
    hints: run.hintsUsed,
  })
