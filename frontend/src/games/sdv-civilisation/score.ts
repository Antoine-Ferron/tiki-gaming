import type { PlayerState } from './game'

const POINTS_PER_SCIENCE_SET = 7
const COINS_PER_TREASURY_POINT = 3

export interface ScoreBreakdown {
  military: number
  treasury: number
  civil: number
  science: number
  total: number
}

/** Somme des carrés de chaque symbole + 7 par série complète, voir docs/games/sdv-civilisation/regles.md#science */
export function scienceScore(tablets: number, gears: number, compasses: number): number {
  return tablets ** 2 + gears ** 2 + compasses ** 2 + POINTS_PER_SCIENCE_SET * Math.min(tablets, gears, compasses)
}

export function finalScore(player: PlayerState): ScoreBreakdown {
  const symbols = (symbol: string) => player.built.filter((c) => c.science === symbol).length
  const military = player.military
  const treasury = Math.floor(player.coins / COINS_PER_TREASURY_POINT)
  const civil = player.built.reduce((sum, card) => sum + (card.points ?? 0), 0)
  const science = scienceScore(symbols('tablet'), symbols('gear'), symbols('compass'))
  return { military, treasury, civil, science, total: military + treasury + civil + science }
}

/** Classement final : le plus haut total gagne ; à égalité, celui qui a le plus de pièces. */
export function ranking(players: PlayerState[]) {
  return players
    .map((player) => ({ name: player.name, isBot: player.isBot, coins: player.coins, score: finalScore(player) }))
    .sort((a, b) => b.score.total - a.score.total || b.coins - a.coins)
}
