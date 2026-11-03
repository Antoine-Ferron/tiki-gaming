import { describe, expect, it } from 'vitest'
import { fillWithBots } from '../bots'

describe('fillWithBots', () => {
  it('complète la table avec des IA jusqu’à 3 joueurs', () => {
    expect(fillWithBots(['alice'])).toEqual([
      { name: 'alice', coins: 1, isBot: false },
      { name: 'IA 1', coins: 1, isBot: true },
      { name: 'IA 2', coins: 1, isBot: true },
    ])
  })

  it('n’ajoute pas d’IA à une table déjà complète', () => {
    expect(fillWithBots(['alice', 'bob', 'carole']).some((seat) => seat.isBot)).toBe(false)
  })
})
