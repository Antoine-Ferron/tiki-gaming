import { ApiError, apiGet, apiPost } from '@/lib/api'
import type { GameView } from './game'
import { TurnConflict, type GameServer } from './ports'
import type { Wonder } from './wonders'

const API = '/games/sdv-civilisation'

/** Serveur de partie de production : l'API du backend Java (même origine, cookie de session et jeton CSRF). */
export const httpGameServer: GameServer = {
  wonders: () => apiGet<Wonder[]>(`${API}/wonders`),
  // 204 : aucune partie en cours.
  current: async () => (await apiGet<GameView | undefined>(`${API}/games/current`)) ?? null,
  start: (wonder) => apiPost<GameView>(`${API}/games`, { wonder }),
  async play(card, action, version) {
    try {
      return await apiPost<GameView>(`${API}/games/current/turns`, { card, action, version })
    } catch (err) {
      // 409 : la partie a avancé sans ce coup ; on relit la partie à jour pour se resynchroniser.
      if (!(err instanceof ApiError) || err.status !== 409) throw err
      const game = await httpGameServer.current()
      if (!game) throw err
      throw new TurnConflict(err.message, game)
    }
  },
  abandon: () => apiPost(`${API}/games/current/abandon`),
}
