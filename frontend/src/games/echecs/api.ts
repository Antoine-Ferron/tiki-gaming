// Client de l'API des échecs (backend Java, sans état : on envoie la position FEN à chaque appel).
import { apiPost } from '@/lib/api'

/** Les cases où peut aller la pièce posée en `from`, triées par le serveur. */
export async function destinations(fen: string, from: string): Promise<string[]> {
  const response = await apiPost<{ destinations: string[] }>('/games/echecs/destinations', { fen, from })
  return response.destinations
}
