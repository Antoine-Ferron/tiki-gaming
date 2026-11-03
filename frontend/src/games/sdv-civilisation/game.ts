import { CARDS_BY_AGE, type Age, type Card, type Cost } from './cards'
import type { Seat } from './bots'
import type { CurrencyConverter, Resource, Shuffler } from './ports'
import { neighbours } from './setup'
import { WONDERS, type Wonder, type WonderStage } from './wonders'

export const HAND_SIZE = 7
export const TURNS_PER_AGE = 6
export const DISCARD_COINS = 3
const VICTORY_TOKENS: Record<Age, number> = { 1: 1, 2: 3, 3: 5 }
const DEFEAT_TOKEN = -1

export interface PlayerState extends Seat {
  wonder: Wonder
  /** Nombre d'étapes de merveille construites, dans l'ordre du plateau. */
  stagesBuilt: number
  built: Card[]
  /** Somme des jetons de conflit gagnés et perdus. */
  military: number
  /** Résultat de chaque duel de fin d'âge, voisin par voisin. */
  tokens: MilitaryToken[]
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

export interface MilitaryToken {
  age: Age
  against: string
  /** +1 / +3 / +5 pour une victoire, −1 pour une défaite, 0 pour une égalité. */
  value: number
}

export interface TurnEvent {
  player: number
  action: Action['type']
  card: Card
  /** Pièces gagnées ou perdues ce tour (commerce compris). */
  coins: number
}

/** Une carte, une action : construire le bâtiment, construire une étape de merveille avec la carte, ou la défausser. */
export type Action = { type: 'build' | 'wonder' | 'discard'; card: string }

export type Refusal = 'built' | 'resources' | 'coins' | 'wonder'

export type Payment =
  | { ok: true; coins: number; toLeft: number; toRight: number; chain: boolean }
  | { ok: false; code: Refusal; reason: string }

/** Distribue une main de 7 cartes de l'âge à chaque joueur : chaque carte existe en un exemplaire par joueur. */
function deal(age: Age, playerCount: number, shuffler: Shuffler): Card[][] {
  // Une copie par exemplaire : deux exemplaires de la même carte dans une main restent deux cartes distinctes.
  const deck = shuffler.shuffle(
    Array.from({ length: playerCount }, () => CARDS_BY_AGE[age].map((c) => ({ ...c }))).flat(),
  )
  return Array.from({ length: playerCount }, (_, i) => deck.slice(i * HAND_SIZE, (i + 1) * HAND_SIZE))
}

/**
 * Mise en place : 3 pièces, un plateau merveille différent par joueur et 7 cartes de l'âge I.
 * Si le premier joueur a choisi sa merveille, les autres reçoivent au hasard les plateaux restants.
 */
export function createGame(seats: Seat[], shuffler: Shuffler, chosen?: Wonder): GameState {
  const wonders = chosen
    ? [chosen, ...shuffler.shuffle(WONDERS.filter((w) => w !== chosen))]
    : shuffler.shuffle(WONDERS)
  return {
    age: 1,
    turn: 1,
    players: seats.map((seat, i) => ({
      ...seat,
      wonder: wonders[i],
      stagesBuilt: 0,
      built: [],
      military: 0,
      tokens: [],
    })),
    hands: deal(1, seats.length, shuffler),
    over: false,
    discards: [],
    lastTurn: [],
    conflicts: null,
  }
}

/** Ressources produites : plateau merveille et cartes marron et grises. */
export function production(player: PlayerState): Resource[] {
  return [player.wonder.resource, ...player.built.flatMap((card) => card.produces ?? [])]
}

function count(resources: Resource[]): Map<Resource, number> {
  const counts = new Map<Resource, number>()
  for (const r of resources) counts.set(r, (counts.get(r) ?? 0) + 1)
  return counts
}

export function builtStages(player: PlayerState): WonderStage[] {
  return player.wonder.stages.slice(0, player.stagesBuilt)
}

/** Puissance militaire : boucliers des cartes rouges et des étapes de merveille. */
export function shields(player: PlayerState): number {
  const fromCards = player.built.reduce((sum, card) => sum + (card.shields ?? 0), 0)
  return fromCards + builtStages(player).reduce((sum, stage) => sum + (stage.shields ?? 0), 0)
}

/**
 * Ce que coûte un coût au joueur : les ressources qu'il ne produit pas sont achetées au voisin de gauche, puis
 * de droite, au prix du convertisseur, dans la limite de ce qu'ils produisent. Les pièces reçues pendant le tour
 * ne servent pas à payer : tout est calculé sur l'état de début de tour.
 */
function pay(state: GameState, index: number, cost: Cost, converter: CurrencyConverter): Payment {
  const player = state.players[index]
  const { left, right } = neighbours(state.players, index)
  const own = count(production(player))
  const fromLeft = count(production(left))
  const fromRight = count(production(right))
  let toLeft = 0
  let toRight = 0

  for (const [resource, needed] of count(cost.resources ?? [])) {
    const missing = Math.max(0, needed - (own.get(resource) ?? 0))
    const leftQty = Math.min(missing, fromLeft.get(resource) ?? 0)
    const rightQty = Math.min(missing - leftQty, fromRight.get(resource) ?? 0)
    if (leftQty + rightQty < missing) return { ok: false, code: 'resources', reason: 'Il te manque des ressources.' }
    if (leftQty > 0) toLeft += converter.toCoins(resource, leftQty)
    if (rightQty > 0) toRight += converter.toCoins(resource, rightQty)
  }

  const coins = (cost.coins ?? 0) + toLeft + toRight
  if (coins > player.coins) return { ok: false, code: 'coins', reason: 'Pas assez de pièces.' }
  return { ok: true, coins, toLeft, toRight, chain: false }
}

/** Construire un bâtiment : jamais deux fois le même, gratuit par chaîne, sinon payé. */
export function payment(state: GameState, index: number, card: Card, converter: CurrencyConverter): Payment {
  const player = state.players[index]
  if (player.built.some((c) => c.name === card.name)) {
    return { ok: false, code: 'built', reason: 'Tu as déjà construit cette carte.' }
  }
  if (player.built.some((c) => c.name === card.chainFrom)) {
    return { ok: true, coins: 0, toLeft: 0, toRight: 0, chain: true }
  }
  return pay(state, index, card.cost, converter)
}

/** Prochaine étape de la merveille du joueur, ou undefined si elle est terminée. */
export function nextStage(player: PlayerState): WonderStage | undefined {
  return player.wonder.stages[player.stagesBuilt]
}

/** Construire l'étape suivante de sa merveille : on paie le coût de l'étape, la carte ne sert que de support. */
export function wonderPayment(state: GameState, index: number, converter: CurrencyConverter): Payment {
  const stage = nextStage(state.players[index])
  if (!stage) return { ok: false, code: 'wonder', reason: 'Ta merveille est déjà terminée.' }
  return pay(state, index, stage.cost, converter)
}

/** Chaque joueur affronte séparément ses deux voisins : victoire selon l'âge, défaite −1, égalité 0. */
function conflictTokens(players: PlayerState[], age: Age): MilitaryToken[][] {
  return players.map((player, index) => {
    const { left, right } = neighbours(players, index)
    const duel = (other: PlayerState) => {
      if (shields(player) > shields(other)) return VICTORY_TOKENS[age]
      if (shields(player) < shields(other)) return DEFEAT_TOKEN
      return 0
    }
    return [
      { age, against: left.name, value: duel(left) },
      { age, against: right.name, value: duel(right) },
    ]
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
  const stagesBuilt = state.players.map((p) => p.stagesBuilt)
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
      const building = action.type === 'build'
      const cost = building ? payment(state, index, card, converter) : wonderPayment(state, index, converter)
      if (!cost.ok) throw new Error(cost.reason)
      // Effet immédiat : pièces de la carte jaune, ou de l'étape de merveille.
      const gain = building ? (card.coins ?? 0) : (nextStage(state.players[index])!.coins ?? 0)
      delta[index] += gain - cost.coins
      delta[(index - 1 + count) % count] += cost.toLeft
      delta[(index + 1) % count] += cost.toRight
      if (building) built[index].push(card)
      // Étape de merveille : la carte est posée face cachée sous le plateau, sans effet.
      else stagesBuilt[index] += 1
    }
    // Un seul exemplaire quitte la main, même si elle en contient deux.
    return hand.filter((_, i) => i !== at)
  })

  const players = state.players.map((p, i) => ({
    ...p,
    coins: p.coins + delta[i],
    built: built[i],
    stagesBuilt: stagesBuilt[i],
  }))
  const lastTurn = played.map((event, player) => ({ ...event, player, coins: delta[player] }))
  // Âges I et III : chaque main part au voisin de gauche, donc on reçoit celle du voisin de droite. Âge II : l'inverse.
  const passed = hands.map((_, i) => hands[state.age === 2 ? (i - 1 + count) % count : (i + 1) % count])

  if (state.turn < TURNS_PER_AGE) {
    return { ...state, turn: state.turn + 1, players, hands: passed, discards, lastTurn, conflicts: null }
  }

  // Fin d'âge : la dernière carte de chaque main est défaussée, puis les conflits sont résolus.
  discards.push(...passed.flat())
  const duels = conflictTokens(players, state.age)
  const conflicts = duels.map((pair) => pair.reduce((sum, token) => sum + token.value, 0))
  const afterConflicts = players.map((p, i) => ({
    ...p,
    military: p.military + conflicts[i],
    tokens: [...p.tokens, ...duels[i]],
  }))
  const end = { players: afterConflicts, discards, lastTurn, conflicts }
  if (state.age === 3) return { ...state, ...end, hands: players.map(() => []), over: true }

  const age = (state.age + 1) as Age
  return { ...end, age, turn: 1, hands: deal(age, count, shuffler), over: false }
}
