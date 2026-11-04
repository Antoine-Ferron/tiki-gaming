import type { Age, Card } from './cards'
import type { Resource } from './ports'
import type { Wonder, WonderStage } from './wonders'

/**
 * Partie telle que le serveur la montre au joueur (voir backend : GameView). Le front n'applique aucune règle :
 * prix, refus, IA, conflits et score viennent du serveur ; ce module ne contient que leurs types et l'affichage.
 */

/** Tours d'un âge, pour afficher « Tour 3 / 6 » (le serveur décide de la fin de l'âge). */
export const TURNS_PER_AGE = 6

export type ActionType = 'build' | 'wonder' | 'discard'

export interface MilitaryToken {
  age: Age
  against: string
  /** +1 / +3 / +5 pour une victoire, −1 pour une défaite, 0 pour une égalité. */
  value: number
}

export interface PlayerState {
  name: string
  isBot: boolean
  coins: number
  wonder: Wonder
  /** Nombre d'étapes de merveille construites, dans l'ordre du plateau. */
  stagesBuilt: number
  built: Card[]
  /** Somme des jetons de conflit gagnés et perdus. */
  military: number
  tokens: MilitaryToken[]
  /** Calculés par le serveur : ressources produites, boucliers et points de science. */
  production: Resource[]
  shields: number
  sciencePoints: number
}

export interface TurnEvent {
  player: number
  action: ActionType
  card: Card
  /** Pièces gagnées ou perdues ce tour (commerce compris). */
  coins: number
}

export type Refusal = 'built' | 'resources' | 'coins' | 'wonder'

export type Payment =
  | { ok: true; coins: number; toLeft: number; toRight: number; chain: boolean }
  | { ok: false; code: Refusal; reason: string }

/** Pour une ressource d'un coût : ce que le joueur produit lui-même, achète à chaque voisin, et ce qui manque. */
export interface ResourceNeed {
  resource: Resource
  needed: number
  own: number
  fromLeft: number
  fromRight: number
  missing: number
}

/** Une carte de la main, avec le prix de sa construction et le détail de ses ressources. */
export interface HandCard {
  card: Card
  build: Payment
  needs: ResourceNeed[]
}

export interface ScoreBreakdown {
  military: number
  treasury: number
  wonder: number
  civil: number
  science: number
  guilds: number
  total: number
}

export interface Ranked {
  name: string
  isBot: boolean
  coins: number
  score: ScoreBreakdown
}

export interface GameView {
  /** +1 à chaque tour : renvoyée avec le coup, pour que le serveur refuse un coup joué sur une partie dépassée. */
  version: number
  age: Age
  turn: number
  over: boolean
  /** Sens de passage des mains à cet âge : vers la gauche aux âges I et III. */
  passesLeft: boolean
  /** Temps restant pour jouer ce tour ; à zéro, le serveur défausse une carte au hasard. */
  remainingMs: number
  /** Le joueur d'abord, puis les IA, dans l'ordre de la table. */
  players: PlayerState[]
  hand: HandCard[]
  /** Prix de la prochaine étape de merveille, et ses ressources. */
  wonder: Payment
  wonderNeeds: ResourceNeed[]
  /** Nombre de cartes défaussées depuis le début de la partie. */
  discards: number
  lastTurn: TurnEvent[]
  /** Jetons gagnés ou perdus par chacun aux conflits de l'âge qui vient de se terminer. */
  conflicts?: number[]
  /** Classement final, une fois la partie terminée. */
  ranking?: Ranked[]
}

/** Prochaine étape de la merveille du joueur, ou undefined si elle est terminée. */
export function nextStage(player: PlayerState): WonderStage | undefined {
  return player.wonder.stages[player.stagesBuilt]
}

/** Les joueurs sont assis en cercle : le premier et le dernier sont voisins. */
export function neighbours<T>(players: T[], index: number): { left: T; right: T } {
  const count = players.length
  return {
    left: players[(index - 1 + count) % count],
    right: players[(index + 1) % count],
  }
}
