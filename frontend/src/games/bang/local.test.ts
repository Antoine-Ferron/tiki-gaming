import { expect, test } from 'vitest'
import { deal, draw, type Shuffle } from './local'

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
