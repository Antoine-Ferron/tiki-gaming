import { createPlayers, MIN_PLAYERS, type Player } from './setup'

export interface Seat extends Player {
  isBot: boolean
}

/**
 * Assoit les joueurs humains et complète la table avec des IA, en attendant le multijoueur.
 * Voir docs/games/sdv-civilisation/regles.md#format
 */
export function fillWithBots(humans: string[], tableSize = MIN_PLAYERS): Seat[] {
  const bots = Array.from({ length: Math.max(0, tableSize - humans.length) }, (_, i) => `IA ${i + 1}`)
  return createPlayers([...humans, ...bots]).map((player, index) => ({ ...player, isBot: index >= humans.length }))
}
