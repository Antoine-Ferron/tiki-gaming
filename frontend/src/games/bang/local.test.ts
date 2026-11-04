import { expect, test, vi } from 'vitest'
import { deal, draw } from './local'

test.each([0, 1, 2])('recycle immédiatement avec %i cartes en pioche, sans modifier l’état fourni', (count) => {
  const game = deal((items) => items)
  const cards = game.drawPile
  game.drawPile = cards.slice(0, count)
  game.discardPile = cards.slice(count)
  const before = structuredClone(game)
  const shuffle = vi.fn(<T>(items: T[]) => items.reverse())
  const result = draw(game, shuffle)
  expect(game).toEqual(before)
  expect(result.discardPile).toEqual([])
  expect(shuffle).toHaveBeenCalledOnce()
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
  const shuffle = vi.fn(<T>(items: T[]) => items)
  expect(() => draw(game, shuffle)).toThrow('La pioche ne contient pas assez de cartes.')
  expect(shuffle).not.toHaveBeenCalled()
  expect(game).toEqual(before)
})
