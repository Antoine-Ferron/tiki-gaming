import { expect, test } from 'vitest'
import { deal, discard, draw, endTurn, fire, respond, type LocalGame, type Shuffle } from './local'

test.each([0, 1, 2])('recycle immédiatement avec %i cartes en pioche, sans modifier l’état fourni', (count) => {
  const game = deal((items) => items)
  const cards = game.drawPile
  game.drawPile = cards.slice(0, count)
  game.discardPile = cards.slice(count)
  const before = structuredClone(game)
  let shuffles = 0
  const shuffle: Shuffle = (items) => {
    shuffles++
    return items.reverse()
  }
  const result = draw(game, shuffle)
  expect(game).toEqual(before)
  expect(result.discardPile).toEqual([])
  expect(shuffles).toBe(1)
  expect(result.drawPile).toHaveLength(cards.length - 2)
  const all = [...result.drawPile, ...result.players.flatMap((p) => p.hand)]
  expect(new Set(all.map((c) => c.id)).size).toBe(37)
  expect(all).toHaveLength(37)
})

test('avec une seule carte disponible au total, refuse avant de mélanger et conserve chaque carte', () => {
  const game = deal((items) => items)
  game.drawPile = []
  game.discardPile = [{ id: 'derniere', type: 'BANG' }]
  const before = structuredClone(game)
  let shuffles = 0
  const shuffle: Shuffle = (items) => {
    shuffles++
    return items
  }
  expect(() => draw(game, shuffle)).toThrow('La pioche ne contient pas assez de cartes.')
  expect(shuffles).toBe(0)
  expect(game).toEqual(before)
})

const unchanged = <T>(items: T[]) => items

test('défausser une carte retire exactement son identifiant et conserve les autres mains', () => {
  const game = endTurn(draw(deal(unchanged), unchanged))
  const before = structuredClone(game)
  const card = game.players[0].hand[2]
  const result = discard(game, card.id)

  expect(result.players[0].hand).toEqual(before.players[0].hand.filter((candidate) => candidate.id !== card.id))
  expect(result.players.slice(1)).toEqual(before.players.slice(1))
  expect(result.discardPile).toEqual([...before.discardPile, card])
  expect(result.phase).toBe('DISCARD')
  expect(result.currentSeat).toBe(1)
  expect(game).toEqual(before)
})

test.each([
  { from: 2, to: 4, allowed: false },
  { from: 4, to: 1, allowed: true },
])('la portée de $from vers $to suit le plus court trajet autour de la table', ({ from, to, allowed }) => {
  const game = draw(deal(unchanged), unchanged)
  game.currentSeat = from
  const before = structuredClone(game)
  const cardId = game.players[from - 1].hand[0].id
  if (allowed) {
    const shot = fire(game, cardId, to)
    expect(shot.pendingShot).toMatchObject({ shooterSeat: from, targetSeat: to })
    expect(shot.players[from - 1].hand).toEqual(before.players[from - 1].hand.filter((card) => card.id !== cardId))
  } else {
    expect(() => fire(game, cardId, to)).toThrow('La cible est hors de portée.')
  }
  expect(game).toEqual(before)
})

function expectAllCards(game: LocalGame) {
  const cards = [...game.players.flatMap((p) => p.hand), ...game.drawPile, ...game.discardPile]
  expect(cards).toHaveLength(37)
  expect(new Set(cards.map((c) => c.id)).size).toBe(37)
}

test.each(['bart-cassidy', 'willy-the-kid'] as const)('%s respecte sa limite de tirs du tour', (character) => {
  const game = draw(deal(unchanged), unchanged)
  game.players[0].character = character
  const shot = fire(game, game.players[0].hand[0].id, 2)
  const resumed = respond(shot, shot.pendingShot!.id, shot.players[1].hand[0].id)
  const before = structuredClone(resumed)
  if (character === 'willy-the-kid') {
    const second = fire(resumed, resumed.players[0].hand[0].id, 2)
    expect(second.players[0].hand).toHaveLength(game.players[0].hand.length - 2)
    expect(second.pendingShot!.id).not.toBe(shot.pendingShot!.id)
    expectAllCards(second)
  } else {
    expect(() => fire(resumed, resumed.players[0].hand[0].id, 2)).toThrow('Un seul BANG ! par tour.')
  }
  expect(resumed).toEqual(before)
})

test('Janet tire un Raté ! et ce tir consomme son unique BANG ! du tour', () => {
  const game = draw(
    deal((items) => {
      if (items[0] === 'bart-cassidy') return [items[1], items[0], ...items.slice(2)]
      if (typeof items[0] === 'object') return [...items].reverse()
      return items
    }),
    unchanged,
  )
  const card = game.players[0].hand[0]
  expect(card.type).toBe('MISSED')
  const shot = fire(game, card.id, 2)
  expect(shot.players[0].hand).not.toContainEqual(card)
  expect(shot.discardPile).toContainEqual(card)
  const resumed = respond(shot, shot.pendingShot!.id, shot.players[1].hand[0].id)
  expect(() => fire(resumed, resumed.players[0].hand[0].id, 2)).toThrow('Un seul BANG ! par tour.')
  expectAllCards(resumed)
})

test('la portée ignore les éliminés et Paul ne majore la distance que lorsqu’il est visé', () => {
  const game = draw(deal(unchanged), unchanged)
  const card = game.players[0].hand[0].id
  const before = structuredClone(game)
  expect(() => fire(game, card, 3)).toThrow('hors de portée')
  expect(game).toEqual(before)
  game.players[2].character = 'willy-the-kid'
  game.players[1].health = 0
  expect(fire(game, card, 3).pendingShot).toMatchObject({ shooterSeat: 1, targetSeat: 3 })
  game.players[1].health = 4
  game.players[1].character = 'paul-regret'
  expect(() => fire(game, card, 2)).toThrow('hors de portée')
  game.players[1].character = 'calamity-janet'
  game.players[0].character = 'paul-regret'
  expect(fire(game, card, 2).pendingShot).toMatchObject({ shooterSeat: 1, targetSeat: 2 })
})

test.each([0, 1, 2, 3])('un tir en attente bloque les autres actions (%i) sans déplacer une carte', (action) => {
  const game = draw(deal(unchanged), unchanged)
  const waiting = fire(game, game.players[0].hand[0].id, 2)
  const before = structuredClone(waiting)
  const commands = [
    () => draw(waiting),
    () => endTurn(waiting),
    () => discard(waiting, waiting.players[0].hand[0].id),
    () => fire(waiting, waiting.players[0].hand[0].id, 2),
  ]
  expect(commands[action]).toThrow()
  expect(waiting).toEqual(before)
  expectAllCards(waiting)
})

test('une mauvaise réponse ou un second clic ne dépense ni carte ni PV', () => {
  const game = draw(deal(unchanged), unchanged)
  game.players[1].character = 'bart-cassidy'
  const waiting = fire(game, game.players[0].hand[0].id, 2)
  const before = structuredClone(waiting)
  expect(() => respond(waiting, 'ancien-tir')).toThrow('plus en attente')
  expect(() => respond(waiting, waiting.pendingShot!.id, waiting.players[1].hand[0].id)).toThrow('Carte indisponible')
  expect(waiting).toEqual(before)
  const damaged = respond(waiting, waiting.pendingShot!.id, undefined, unchanged)
  const stable = structuredClone(damaged)
  expect(() => respond(damaged, waiting.pendingShot!.id)).toThrow('plus en attente')
  expect(damaged).toEqual(stable)
  expect(damaged.players[1]).toMatchObject({ health: 3, maxHealth: 4 })
  expect(damaged.players[1].hand).toHaveLength(waiting.players[1].hand.length + 1)
  expectAllCards(damaged)
})

test.each([1, 4])('le bonus de Bart à %i PV dépend de sa survie, même quand il faut recycler', (health) => {
  const game = draw(deal(unchanged), unchanged)
  game.players[1].character = 'bart-cassidy'
  game.players[1].health = health
  game.discardPile = game.drawPile
  game.drawPile = []
  const waiting = fire(game, game.players[0].hand[0].id, 2)
  let shuffles = 0
  const result = respond(waiting, waiting.pendingShot!.id, undefined, (items) => {
    shuffles++
    return items
  })
  expect(result.players[1].health).toBe(health - 1)
  expect(result.players[1].maxHealth).toBe(4)
  expect(result.players[1].hand).toHaveLength(waiting.players[1].hand.length + (health > 1 ? 1 : 0))
  expect(shuffles).toBe(health > 1 ? 1 : 0)
  expect(result.currentSeat).toBe(1)
  expect(result.phase).toBe('PLAY')
  expectAllCards(result)
})
