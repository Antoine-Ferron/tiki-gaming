import { describe, expect, it } from 'vitest'
import {
  type Dice,
  type DieValue,
  type Sheet,
  availableCategories,
  fillCategory,
  isGameOver,
  LOWER_CATEGORIES,
  newGame,
  playCategory,
  reroll,
  roll,
  scoreCategory,
  toggleKeep,
  UPPER_CATEGORIES,
  totalScore,
  upperBonus,
  winner,
} from './logic'

const d = (...values: DieValue[]) => values as unknown as Dice

describe('scoreCategory', () => {
  it('additionne les dés de la face choisie en section haute', () => {
    expect(scoreCategory(d(3, 3, 1, 5, 3), 'trois')).toBe(9)
  })

  it('compte un brelan à partir de trois dés identiques, pas avec une paire', () => {
    expect(scoreCategory(d(4, 4, 4, 2, 5), 'brelan')).toBe(19)
    expect(scoreCategory(d(4, 4, 2, 2, 5), 'brelan')).toBe(0)
  })

  it('compte un carré à partir de quatre dés identiques', () => {
    expect(scoreCategory(d(5, 5, 5, 5, 1), 'carre')).toBe(21)
    expect(scoreCategory(d(5, 5, 5, 2, 1), 'carre')).toBe(0)
    expect(scoreCategory(d(2, 2, 2, 2, 2), 'carre')).toBe(10)
  })

  it('donne 25 points pour un full, rien pour deux paires', () => {
    expect(scoreCategory(d(3, 3, 3, 6, 6), 'full')).toBe(25)
    expect(scoreCategory(d(3, 3, 6, 6, 1), 'full')).toBe(0)
    expect(scoreCategory(d(4, 4, 4, 4, 4), 'full')).toBe(0)
  })

  it('reconnaît une petite suite malgré un doublon, pas une série trouée', () => {
    expect(scoreCategory(d(1, 2, 3, 4, 4), 'petiteSuite')).toBe(30)
    expect(scoreCategory(d(1, 2, 3, 5, 6), 'petiteSuite')).toBe(0)
  })

  it('donne 40 points pour une grande suite, rien avec quatre valeurs seulement', () => {
    expect(scoreCategory(d(2, 3, 4, 5, 6), 'grandeSuite')).toBe(40)
    expect(scoreCategory(d(1, 2, 3, 4, 6), 'grandeSuite')).toBe(0)
  })

  it('donne 50 points pour un Yams, rien avec quatre dés identiques', () => {
    expect(scoreCategory(d(6, 6, 6, 6, 6), 'yams')).toBe(50)
    expect(scoreCategory(d(6, 6, 6, 6, 1), 'yams')).toBe(0)
  })

  it('additionne tous les dés pour la chance', () => {
    expect(scoreCategory(d(1, 3, 4, 5, 6), 'chance')).toBe(19)
  })
})

describe('feuille de score', () => {
  it('donne le bonus de 35 points à partir de 63 en section haute', () => {
    const upper = { deux: 6, trois: 9, quatre: 12, cinq: 15, six: 18 }

    expect(upperBonus(upper)).toBe(0)
    expect(upperBonus({ ...upper, as: 2 })).toBe(0)
    expect(upperBonus({ ...upper, as: 3 })).toBe(35)
  })

  it('inscrit le score dans une case libre, qui n’est plus disponible ensuite', () => {
    const sheet = fillCategory({}, 'full', d(2, 2, 2, 5, 5))

    expect(sheet).toEqual({ full: 25 })
    expect(availableCategories(sheet)).not.toContain('full')
  })

  it('refuse une case déjà jouée', () => {
    expect(() => fillCategory({ yams: 0 }, 'yams', d(6, 6, 6, 6, 6))).toThrow('Case déjà jouée')
  })

  it('ne donne aucune prime pour un deuxième Yams', () => {
    const sheet = fillCategory({ yams: 50 }, 'chance', d(6, 6, 6, 6, 6))

    expect(totalScore(sheet)).toBe(80)
  })
})

describe('tour de jeu', () => {
  const turn = { dice: d(3, 1, 4, 1, 5), kept: [false, false, false, false, false] as const, rollsUsed: 1 }

  it('ne relance que les dés non conservés', () => {
    const kept = toggleKeep(toggleKeep(turn, 0), 1)

    const next = reroll(kept, () => 6)

    expect(next.dice).toEqual([3, 1, 6, 6, 6])
    expect(next.rollsUsed).toBe(2)
  })

  it('refuse un dé inexistant et un quatrième lancer', () => {
    expect(() => toggleKeep(turn, 5)).toThrow('Dé inexistant')
    expect(() => reroll({ ...turn, rollsUsed: 3 }, () => 6)).toThrow('Plus de lancer disponible')
  })
})

describe('partie à deux joueurs', () => {
  const complete = (value: number): Sheet =>
    Object.fromEntries([...UPPER_CATEGORIES, ...LOWER_CATEGORIES].map((c) => [c, value]))

  it('lance cinq dés au premier lancer, puis relance les dés non conservés', () => {
    const first = roll(newGame(), () => 2)
    const second = roll({ ...first, turn: toggleKeep(first.turn!, 0) }, () => 5)

    expect(first.turn).toEqual({ dice: [2, 2, 2, 2, 2], kept: [false, false, false, false, false], rollsUsed: 1 })
    expect(second.turn?.dice).toEqual([2, 5, 5, 5, 5])
  })

  it('inscrit la case pour le joueur courant puis passe la main à l’autre', () => {
    const afterPlayer1 = playCategory(
      roll(newGame(), () => 4),
      'yams',
    )
    const afterPlayer2 = playCategory(
      roll(afterPlayer1, () => 1),
      'as',
    )

    expect(afterPlayer1).toEqual({ sheets: [{ yams: 50 }, {}], current: 1, turn: null })
    expect(afterPlayer2.sheets[1]).toEqual({ as: 5 })
    expect(afterPlayer2.current).toBe(0)
  })

  it('refuse de choisir une case avant d’avoir lancé les dés', () => {
    expect(() => playCategory(newGame(), 'chance')).toThrow('Lance les dés')
  })

  it('n’est terminée que lorsque les deux feuilles sont complètes', () => {
    expect(isGameOver({ sheets: [complete(5), {}], current: 1, turn: null })).toBe(false)
    expect(isGameOver({ sheets: [complete(5), complete(5)], current: 0, turn: null })).toBe(true)
  })

  it('désigne le joueur au plus gros total, ou personne en cas d’égalité', () => {
    expect(winner({ sheets: [complete(6), complete(5)], current: 0, turn: null })).toBe(0)
    expect(winner({ sheets: [complete(5), complete(6)], current: 0, turn: null })).toBe(1)
    expect(winner({ sheets: [complete(5), complete(5)], current: 0, turn: null })).toBeNull()
  })
})
