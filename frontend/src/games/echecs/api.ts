// Client de l'API des échecs (backend Java, sans état : on envoie la position FEN à chaque appel).
import { apiPost } from '@/lib/api'

/** État de la partie renvoyé par le serveur pour le camp au trait. */
export type GameStatus =
  | 'ONGOING'
  | 'CHECK'
  | 'CHECKMATE'
  | 'STALEMATE'
  | 'DRAW_INSUFFICIENT_MATERIAL'
  | 'DRAW_FIFTY_MOVES'

/** Promotion d'un pion : dame, tour, fou ou cavalier (lettres FEN). */
export type Promotion = 'q' | 'r' | 'b' | 'n'

export type MoveResult = { fen: string; status: GameStatus }

/** Les coups légaux de la pièce posée en `from`, triés par le serveur. */
export async function destinations(fen: string, from: string): Promise<string[]> {
  const response = await apiPost<{ destinations: string[] }>('/games/echecs/destinations', { fen, from })
  return response.destinations
}

/**
 * Joue le coup `from` → `to` (avec la promotion choisie si un pion atteint la dernière rangée) et renvoie la position
 * suivante et l'état de la partie. Un coup refusé lève une `ApiError` 422.
 */
export async function play(fen: string, from: string, to: string, promotion?: Promotion): Promise<MoveResult> {
  return apiPost<MoveResult>('/games/echecs/moves', { fen, from, to, promotion })
}
