import type { Realtime } from '../ports'
import type { GameDeps } from '../sdk'
import { browserStorage } from './local'
import { supabaseSaves, supabaseScores } from './supabase'

/**
 * Le client STOMP (`@stomp/stompjs`, `sockjs-client`) n'est chargé que si un jeu appelle réellement
 * `createRoom`/`joinRoom` : un jeu solo n'alourdit pas le chargement initial de la plateforme avec lui.
 */
function lazyRealtime(gameSlug: string): Realtime {
  const realtime = import('./realtime').then((module) => module.createRealtime(gameSlug))
  return {
    createRoom: async (maxPlayers) => (await realtime).createRoom(maxPlayers),
    joinRoom: async (code) => (await realtime).joinRoom(code),
  }
}

/** Point d'assemblage : branche les ports du SDK sur Supabase, le localStorage du navigateur et le WebSocket. */
export function platformDeps(): GameDeps {
  return { scores: supabaseScores, playerSaves: supabaseSaves, storage: browserStorage(), realtime: lazyRealtime }
}
