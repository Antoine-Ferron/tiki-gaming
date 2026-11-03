import { builtStages, type PlayerState } from './game'
import { neighbours } from './setup'

const POINTS_PER_SCIENCE_SET = 7
const COINS_PER_TREASURY_POINT = 3

export interface ScoreBreakdown {
  military: number
  treasury: number
  wonder: number
  civil: number
  science: number
  guilds: number
  total: number
}

/** Somme des carrés de chaque symbole + 7 par série complète, voir docs/games/sdv-civilisation/regles.md#science */
export function scienceScore(tablets: number, gears: number, compasses: number): number {
  return tablets ** 2 + gears ** 2 + compasses ** 2 + POINTS_PER_SCIENCE_SET * Math.min(tablets, gears, compasses)
}

/** Score final du joueur `index` : les guildes comptent des cartes chez ses deux voisins. */
export function finalScore(players: PlayerState[], index: number): ScoreBreakdown {
  const player = players[index]
  const { left, right } = neighbours(players, index)
  const symbols = (symbol: string) => player.built.filter((c) => c.science === symbol).length

  const military = player.military
  const treasury = Math.floor(player.coins / COINS_PER_TREASURY_POINT)
  const wonder = builtStages(player).reduce((sum, stage) => sum + (stage.points ?? 0), 0)
  const civil = player.built.reduce((sum, card) => sum + (card.points ?? 0), 0)
  const science = scienceScore(symbols('tablet'), symbols('gear'), symbols('compass'))
  const guilds = player.built
    .filter((card) => card.guild)
    .reduce(
      (sum, guild) => sum + [...left.built, ...right.built].filter((c) => guild.guild!.includes(c.color)).length,
      0,
    )

  return {
    military,
    treasury,
    wonder,
    civil,
    science,
    guilds,
    total: military + treasury + wonder + civil + science + guilds,
  }
}

/** Classement final : le plus haut total gagne ; à égalité, celui qui a le plus de pièces. */
export function ranking(players: PlayerState[]) {
  return players
    .map((player, index) => ({
      name: player.name,
      isBot: player.isBot,
      coins: player.coins,
      score: finalScore(players, index),
    }))
    .sort((a, b) => b.score.total - a.score.total || b.coins - a.coins)
}
