// Client de l'API des échecs (backend Java, sans état : on envoie la position FEN à chaque appel).
import { apiPost } from '@/lib/api'

/** Les cases où peut aller la pièce posée en `from`, triées par le serveur. */
export async function destinations(fen: string, from: string): Promise<string[]> {
  const response = await apiPost<{ destinations: string[] }>('/games/echecs/destinations', { fen, from })
  return response.destinations
}

/** Joue le coup `from` → `to` et renvoie la position suivante (FEN). Un coup refusé lève une `ApiError` 422. */
export async function play(fen: string, from: string, to: string): Promise<string> {
  const response = await apiPost<{ fen: string }>('/games/echecs/moves', { fen, from, to })
  return response.fen
}
