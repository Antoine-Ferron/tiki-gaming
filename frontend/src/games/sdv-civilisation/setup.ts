export const MIN_PLAYERS = 3
export const MAX_PLAYERS = 7
export const STARTING_COINS = 1

export interface Player {
  name: string
  coins: number
}

/** Mise en place des joueurs, voir docs/games/sdv-civilisation/regles.md#mise-en-place */
export function createPlayers(names: string[]): Player[] {
  if (names.length < MIN_PLAYERS || names.length > MAX_PLAYERS) {
    throw new Error(`Il faut entre ${MIN_PLAYERS} et ${MAX_PLAYERS} joueurs`)
  }
  return names.map((name) => ({ name, coins: STARTING_COINS }))
}

/** Les joueurs sont assis en cercle : le premier et le dernier sont voisins. */
export function neighbours<T>(players: T[], index: number): { left: T; right: T } {
  const count = players.length
  return {
    left: players[(index - 1 + count) % count],
    right: players[(index + 1) % count],
  }
}
