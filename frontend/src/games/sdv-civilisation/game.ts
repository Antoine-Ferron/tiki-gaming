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
  /** Cartes défaussées depuis le début de la partie, visibles de tous. */
  discards: Card[]
  /** Ce que chaque joueur a fait au dernier tour, à afficher au joueur. */
  lastTurn: TurnEvent[]
  /** Jetons gagnés ou perdus par chaque joueur aux conflits de l'âge qui vient de se terminer, sinon null. */
  conflicts: number[] | null
}

export interface TurnEvent {
  player: number
  action: Action['type']
  card: Card
  /** Pièces gagnées ou perdues ce tour (commerce compris). */
  coins: number
}

export type Action = { type: 'build'; card: string } | { type: 'discard'; card: string }

export type Refusal = 'built' | 'resources' | 'coins'

export type Payment =
  { ok: true; coins: number; toLeft: number; toRight: number } | { ok: false; code: Refusal; reason: string }

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
    discards: [],
    lastTurn: [],
    conflicts: null,
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
  if (player.built.some((c) => c.name === card.name))
    return { ok: false, code: 'built', reason: 'Tu as déjà construit cette carte.' }

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
    if (leftQty + rightQty < missing) return { ok: false, code: 'resources', reason: 'Il te manque des ressources.' }
    if (leftQty > 0) toLeft += converter.toCoins(resource, leftQty)
    if (rightQty > 0) toRight += converter.toCoins(resource, rightQty)
  }

  const coins = (card.cost.coins ?? 0) + toLeft + toRight
  if (coins > player.coins) return { ok: false, code: 'coins', reason: 'Pas assez de pièces.' }
  return { ok: true, coins, toLeft, toRight }
}

/** Chaque joueur affronte ses deux voisins : victoire selon l'âge, défaite −1, égalité 0. */
function conflictTokens(players: PlayerState[], age: Age): number[] {
  return players.map((player, index) => {
    const { left, right } = neighbours(players, index)
    return [left, right].reduce((sum, other) => {
      if (shields(player) > shields(other)) return sum + VICTORY_TOKENS[age]
      if (shields(player) < shields(other)) return sum + DEFEAT_TOKEN
      return sum
    }, 0)
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
  const discards = [...state.discards]
  const played: { action: Action['type']; card: Card }[] = []
  const count = state.players.length

  const hands = actions.map((action, index) => {
    const hand = state.hands[index]
    const at = hand.findIndex((c) => c.name === action.card)
    const card = hand[at]
    if (!card) throw new Error(`Cette carte n'est pas dans ta main : ${action.card}`)
    played.push({ action: action.type, card })

    if (action.type === 'discard') {
      delta[index] += DISCARD_COINS
      discards.push(card)
    } else {
      const cost = payment(state, index, card, converter)
      if (!cost.ok) throw new Error(cost.reason)
      delta[index] += (card.coins ?? 0) - cost.coins
      delta[(index - 1 + count) % count] += cost.toLeft
      delta[(index + 1) % count] += cost.toRight
      built[index].push(card)
    }
    // Un seul exemplaire quitte la main, même si elle en contient deux.
    return hand.filter((_, i) => i !== at)
  })

  const players = state.players.map((p, i) => ({ ...p, coins: p.coins + delta[i], built: built[i] }))
  const lastTurn = played.map((event, player) => ({ ...event, player, coins: delta[player] }))
  // Âges I et III : chaque main part au voisin de gauche, donc on reçoit celle du voisin de droite. Âge II : l'inverse.
  const passed = hands.map((_, i) => hands[state.age === 2 ? (i - 1 + count) % count : (i + 1) % count])

  if (state.turn < TURNS_PER_AGE) {
    return { ...state, turn: state.turn + 1, players, hands: passed, discards, lastTurn, conflicts: null }
  }

  // Fin d'âge : la dernière carte de chaque main est défaussée, puis les conflits sont résolus.
  discards.push(...passed.flat())
  const conflicts = conflictTokens(players, state.age)
  const afterConflicts = players.map((p, i) => ({ ...p, military: p.military + conflicts[i] }))
  const end = { players: afterConflicts, discards, lastTurn, conflicts }
  if (state.age === 3) return { ...state, ...end, hands: players.map(() => []), over: true }

  const age = (state.age + 1) as Age
  return { ...end, age, turn: 1, hands: deal(age, count, shuffler), over: false }
}
