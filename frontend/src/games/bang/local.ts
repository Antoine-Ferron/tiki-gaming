import { CHARACTERS, canUseAs, type Character } from './cards/characters'
import type { GameView, Phase, ViewCard } from './board/view'

/**
 * Partie locale à quatre sur le même écran, sans serveur. Reprend la donne et les tours du serveur
 * (docs/games/bang/deroulement-tours.md) : à retirer quand le jeu en ligne sera la seule voie.
 */
export interface LocalPlayer {
  seat: number
  role: 'SHERIFF' | 'OUTLAW' | 'RENEGADE'
  character: Character
  health: number
  hand: ViewCard[]
}

export interface LocalGame {
  players: LocalPlayer[]
  drawPile: ViewCard[]
  discardPile: ViewCard[]
  currentSeat: number
  phase: Phase
  shotsThisTurn: number
  pendingShot?: GameView['pendingShot']
}

export type Shuffle = <T>(items: T[]) => T[]

const shuffleAtRandom: Shuffle = (items) => {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

/** La pioche du prototype : 25 BANG ! et 12 Raté !. */
function deck(): ViewCard[] {
  const bangs = Array.from({ length: 25 }, (_, i) => ({ id: `BANG-${i + 1}`, type: 'BANG' }))
  const missed = Array.from({ length: 12 }, (_, i) => ({ id: `MISSED-${i + 1}`, type: 'MISSED' }))
  return [...bangs, ...missed]
}

/** Un Shérif, deux hors-la-loi et un Renégat ; PV du personnage (+1 pour le Shérif) et autant de cartes en main. */
export function deal(shuffle: Shuffle = shuffleAtRandom): LocalGame {
  const roles = shuffle<LocalPlayer['role']>(['SHERIFF', 'OUTLAW', 'OUTLAW', 'RENEGADE'])
  const characters = shuffle(Object.keys(CHARACTERS) as Character[])
  let pile = shuffle(deck())
  const players = roles.map((role, index) => {
    const character = characters[index]
    const health = CHARACTERS[character].lifePoints + (role === 'SHERIFF' ? 1 : 0)
    const hand = pile.slice(0, health)
    pile = pile.slice(health)
    return { seat: index + 1, role, character, health, hand }
  })
  const sheriff = players.find((p) => p.role === 'SHERIFF')!
  return { players, drawPile: pile, discardPile: [], currentSeat: sheriff.seat, phase: 'DRAW', shotsThisTurn: 0 }
}

const activeOf = (game: LocalGame) => game.players.find((p) => p.seat === game.currentSeat)!

function withActive(game: LocalGame, change: Partial<LocalPlayer>): LocalPlayer[] {
  return game.players.map((p) => (p.seat === game.currentSeat ? { ...p, ...change } : p))
}

/** Les deux premières cartes de la pioche vont dans la main du joueur actif, qui passe en phase de jeu. */
export function draw(game: LocalGame, shuffle: Shuffle = shuffleAtRandom): LocalGame {
  if (game.pendingShot) throw new Error("La cible doit d'abord répondre au tir.")
  if (game.phase !== 'DRAW') throw new Error('Tu as déjà pioché ce tour-ci.')
  if (game.drawPile.length + game.discardPile.length < 2) throw new Error('La pioche ne contient pas assez de cartes.')
  let pile = [...game.drawPile]
  let discarded = [...game.discardPile]
  const recycle = () => {
    if (pile.length === 0 && discarded.length > 0) {
      pile = shuffle(discarded)
      discarded = []
    }
  }
  const drawn: ViewCard[] = []
  recycle()
  for (let index = 0; index < 2; index++) {
    drawn.push(pile.shift()!)
    recycle()
  }
  const player = activeOf(game)
  return {
    ...game,
    players: withActive(game, { hand: [...player.hand, ...drawn] }),
    drawPile: pile,
    discardPile: discarded,
    phase: 'PLAY',
  }
}

/** Avec plus de cartes que de PV, le tour passe par la défausse ; sinon il passe au joueur vivant suivant. */
export function endTurn(game: LocalGame): LocalGame {
  if (game.pendingShot) throw new Error("La cible doit d'abord répondre au tir.")
  if (game.phase === 'DRAW') throw new Error("Pioche d'abord tes deux cartes.")
  const player = activeOf(game)
  const tooMany = player.hand.length > player.health
  if (game.phase === 'PLAY' && tooMany) return { ...game, phase: 'DISCARD' }
  if (tooMany) throw new Error(`Défausse d'abord jusqu'à ${player.health} cartes.`)
  const living = game.players.filter((p) => p.health > 0)
  const next = living.find((p) => p.seat > game.currentSeat) ?? living[0]
  return { ...game, currentSeat: next.seat, phase: 'DRAW', shotsThisTurn: 0 }
}

/** Défausse une carte de la main du joueur actif, tant qu'il a plus de cartes que de PV. */
export function discard(game: LocalGame, cardId: string): LocalGame {
  if (game.pendingShot) throw new Error("La cible doit d'abord répondre au tir.")
  const player = activeOf(game)
  if (game.phase !== 'DISCARD' || player.hand.length <= player.health)
    throw new Error('Tu ne peux pas te défausser maintenant.')
  const card = player.hand.find((c) => c.id === cardId)
  if (!card) throw new Error("Cette carte n'est pas dans ta main.")
  return {
    ...game,
    players: withActive(game, { hand: player.hand.filter((c) => c.id !== cardId) }),
    discardPile: [...game.discardPile, card],
  }
}

/** Les mêmes contrats de carte, portée et limite de tir qu'en ligne ; un refus ne modifie aucune carte. */
export function fire(game: LocalGame, cardId: string, targetSeat: number): LocalGame {
  if (game.phase !== 'PLAY' || game.pendingShot) throw new Error('Tu ne peux pas tirer maintenant.')
  const shooter = activeOf(game)
  if (shooter.character !== 'willy-the-kid' && game.shotsThisTurn >= 1) throw new Error('Un seul BANG ! par tour.')
  const card = shooter.hand.find((c) => c.id === cardId && canUseAs(shooter.character, c.type, 'BANG'))
  if (!card) throw new Error('Carte indisponible.')
  const target = game.players.find((p) => p.seat === targetSeat && p.health > 0)
  if (!target || targetSeat === shooter.seat) throw new Error('Cible invalide.')
  const seats = game.players.filter((p) => p.health > 0).map((p) => p.seat)
  const gap = Math.abs(seats.indexOf(shooter.seat) - seats.indexOf(targetSeat))
  const distance = Math.min(gap, seats.length - gap) + (target.character === 'paul-regret' ? 1 : 0)
  if (distance > 1) throw new Error('La cible est hors de portée.')
  return {
    ...game,
    players: withActive(game, { hand: shooter.hand.filter((c) => c.id !== cardId) }),
    discardPile: [...game.discardPile, card],
    pendingShot: { id: crypto.randomUUID(), shooterSeat: shooter.seat, targetSeat },
    shotsThisTurn: game.shotsThisTurn + 1,
  }
}

/** Ce que voit le joueur de la place `seat` : sa main et son rôle, des autres seulement le nombre de cartes et le Shérif. */
export function viewOf(game: LocalGame, seat: number): GameView {
  const me = game.players.find((p) => p.seat === seat)!
  return {
    code: 'LOCAL',
    seat,
    currentSeat: game.currentSeat,
    phase: game.phase,
    role: me.role,
    hand: me.hand,
    pendingShot: game.pendingShot,
    players: game.players.map((p) => ({
      seat: p.seat,
      character: p.character.toUpperCase().replace(/-/g, '_'),
      health: p.health,
      maxHealth: p.health,
      playedCards: [],
      handCount: p.hand.length,
      ...(p.role === 'SHERIFF' ? { role: 'SHERIFF' } : {}),
    })),
  }
}
