import { describe, expect, it } from 'vitest'
import { type Dice, type DieValue, fillCategory, reroll, scoreCategory, toggleKeep, upperBonus } from './logic'

const d = (...values: DieValue[]) => values as unknown as Dice

describe('scoreCategory', () => {
  it('additionne les dés de la face choisie en section haute', () => {
    expect(scoreCategory(d(3, 3, 1, 5, 3), 'trois')).toBe(9)
  })

  it('compte un brelan à partir de trois dés identiques, pas avec une paire', () => {
    expect(scoreCategory(d(4, 4, 4, 2, 5), 'brelan')).toBe(19)
    expect(scoreCategory(d(4, 4, 2, 2, 5), 'brelan')).toBe(0)
  })

  it('donne 25 points pour un full', () => {
    expect(scoreCategory(d(3, 3, 3, 6, 6), 'full')).toBe(25)
  })

  it('reconnaît une petite suite malgré un doublon', () => {
    expect(scoreCategory(d(1, 2, 3, 4, 4), 'petiteSuite')).toBe(30)
  })

  it('donne 50 points pour un Yams', () => {
    expect(scoreCategory(d(6, 6, 6, 6, 6), 'yams')).toBe(50)
  })
})

describe('feuille de score', () => {
  it('donne le bonus de 35 points à partir de 63 en section haute', () => {
    const upper = { deux: 6, trois: 9, quatre: 12, cinq: 15, six: 18 }

    expect(upperBonus({ ...upper, as: 2 })).toBe(0)
    expect(upperBonus({ ...upper, as: 3 })).toBe(35)
  })

  it('refuse une case déjà jouée', () => {
    expect(() => fillCategory({ yams: 0 }, 'yams', d(6, 6, 6, 6, 6))).toThrow('Case déjà jouée')
  })
})

describe('tour de jeu', () => {
  it('ne relance que les dés non conservés', () => {
    const turn = { dice: d(3, 1, 4, 1, 5), kept: [false, false, false, false, false] as const, rollsUsed: 1 }
    const kept = toggleKeep(toggleKeep(turn, 0), 1)

    const next = reroll(kept, () => 6)

    expect(next.dice).toEqual([3, 1, 6, 6, 6])
    expect(next.rollsUsed).toBe(2)
  })
})
