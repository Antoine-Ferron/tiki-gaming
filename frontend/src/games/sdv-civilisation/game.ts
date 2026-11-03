import { CARDS_BY_AGE, type Age, type Card } from './cards'
import type { Seat } from './bots'
import type { CurrencyConverter, Resource, Shuffler } from './ports'
import { neighbours } from './setup'

export const HAND_SIZE = 7
export const TURNS_PER_AGE = 6
export const DISCARD_COINS = 3
const VICTORY_TOKENS: Record<Age, number> = { 1: 1, 2: 3, 3: 5 }
const DEFEAT_TOKEN = -1

export interface PlayerState extends Seat {
  built: Card[]
  /** Somme des jetons de conflit gagnés et perdus. */
  military: number
}

export interface GameState {
  age: Age
  turn: number
  players: PlayerState[]
  hands: Card[][]
  over: boolean
  /** Ce qui s'est passé au dernier tour, à afficher au joueur. */
  log: string[]
}

export type Action = { type: 'build'; card: string } | { type: 'discard'; card: string }

export type Payment = { ok: true; coins: number; toLeft: number; toRight: number } | { ok: false; reason: string }

/** Distribue une main de 7 cartes de l'âge à chaque joueur : chaque carte existe en un exemplaire par joueur. */
function deal(age: Age, playerCount: number, shuffler: Shuffler): Card[][] {
  // Une copie par exemplaire : deux exemplaires de la même carte dans une main restent deux cartes distinctes.
  const deck = shuffler.shuffle(
    Array.from({ length: playerCount }, () => CARDS_BY_AGE[age].map((c) => ({ ...c }))).flat(),
  )
  return Array.from({ length: playerCount }, (_, i) => deck.slice(i * HAND_SIZE, (i + 1) * HAND_SIZE))
}

export function createGame(seats: Seat[], shuffler: Shuffler): GameState {
  return {
    age: 1,
    turn: 1,
    players: seats.map((seat) => ({ ...seat, built: [], military: 0 })),
    hands: deal(1, seats.length, shuffler),
    over: false,
    log: [],
  }
}

function production(player: PlayerState): Resource[] {
  return player.built.flatMap((card) => card.produces ?? [])
}

function count(resources: Resource[]): Map<Resource, number> {
  const counts = new Map<Resource, number>()
  for (const r of resources) counts.set(r, (counts.get(r) ?? 0) + 1)
  return counts
}

export function shields(player: PlayerState): number {
  return player.built.reduce((sum, card) => sum + (card.shields ?? 0), 0)
}

/**
 * Ce que coûte la carte au joueur : les ressources qu'il ne produit pas sont achetées au voisin de gauche,
 * puis de droite, au prix du convertisseur. Voir docs/games/sdv-civilisation/regles.md#construire-un-bâtiment
 */
export function payment(state: GameState, index: number, card: Card, converter: CurrencyConverter): Payment {
  const player = state.players[index]
  if (player.built.some((c) => c.name === card.name)) return { ok: false, reason: 'Tu as déjà construit cette carte.' }

  const { left, right } = neighbours(state.players, index)
  const own = count(production(player))
  const fromLeft = count(production(left))
  const fromRight = count(production(right))
  let toLeft = 0
  let toRight = 0

  for (const [resource, needed] of count(card.cost.resources ?? [])) {
    const missing = Math.max(0, needed - (own.get(resource) ?? 0))
    const leftQty = Math.min(missing, fromLeft.get(resource) ?? 0)
    const rightQty = Math.min(missing - leftQty, fromRight.get(resource) ?? 0)
    if (leftQty + rightQty < missing) return { ok: false, reason: 'Il te manque des ressources.' }
    if (leftQty > 0) toLeft += converter.toCoins(resource, leftQty)
    if (rightQty > 0) toRight += converter.toCoins(resource, rightQty)
  }

  const coins = (card.cost.coins ?? 0) + toLeft + toRight
  if (coins > player.coins) return { ok: false, reason: 'Pas assez de pièces.' }
  return { ok: true, coins, toLeft, toRight }
}

/** Chaque joueur affronte ses deux voisins : victoire selon l'âge, défaite −1, égalité 0. */
function resolveConflicts(players: PlayerState[], age: Age): PlayerState[] {
  return players.map((player, index) => {
    const { left, right } = neighbours(players, index)
    const tokens = [left, right].reduce((sum, other) => {
      if (shields(player) > shields(other)) return sum + VICTORY_TOKENS[age]
      if (shields(player) < shields(other)) return sum + DEFEAT_TOKEN
      return sum
    }, 0)
    return { ...player, military: player.military + tokens }
  })
}

/**
 * Joue un tour : toutes les actions sont choisies sur l'état de début de tour puis appliquées en même temps.
 * Lève une erreur (message pour le joueur) si une action est impossible.
 */
export function playTurn(
  state: GameState,
  actions: Action[],
  converter: CurrencyConverter,
  shuffler: Shuffler,
): GameState {
  const delta = state.players.map(() => 0)
  const built = state.players.map((p) => [...p.built])
  const log: string[] = []
  const count = state.players.length

  const hands = actions.map((action, index) => {
    const hand = state.hands[index]
    const at = hand.findIndex((c) => c.name === action.card)
    const card = hand[at]
    if (!card) throw new Error(`Cette carte n'est pas dans ta main : ${action.card}`)
    const name = state.players[index].name

    if (action.type === 'discard') {
      delta[index] += DISCARD_COINS
      log.push(`${name} défausse ${card.name} (+${DISCARD_COINS} pièces)`)
    } else {
      const cost = payment(state, index, card, converter)
      if (!cost.ok) throw new Error(cost.reason)
      delta[index] += (card.coins ?? 0) - cost.coins
      delta[(index - 1 + count) % count] += cost.toLeft
      delta[(index + 1) % count] += cost.toRight
      built[index].push(card)
      log.push(`${name} construit ${card.name}`)
    }
    // Un seul exemplaire quitte la main, même si elle en contient deux.
    return hand.filter((_, i) => i !== at)
  })

  let players = state.players.map((p, i) => ({ ...p, coins: p.coins + delta[i], built: built[i] }))
  // Âges I et III : chaque main part au voisin de gauche, donc on reçoit celle du voisin de droite. Âge II : l'inverse.
  const passed = hands.map((_, i) => hands[state.age === 2 ? (i - 1 + count) % count : (i + 1) % count])

  if (state.turn < TURNS_PER_AGE) return { ...state, turn: state.turn + 1, players, hands: passed, log }

  // Fin d'âge : la dernière carte de chaque main est défaussée, puis les conflits sont résolus.
  players = resolveConflicts(players, state.age)
  log.push(`Fin de l'âge ${state.age} : conflits militaires résolus`)
  if (state.age === 3) return { ...state, players, hands: players.map(() => []), over: true, log }

  const age = (state.age + 1) as Age
  return { age, turn: 1, players, hands: deal(age, count, shuffler), over: false, log }
}
