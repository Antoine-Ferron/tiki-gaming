import { describe, expect, test } from 'vitest'
import { DEFAULT_MAX_MISTAKES, isLost, mistakesLabel, mistakesWarning, remainingMistakes } from './mistakes'

const LAST_CHANCE = 'Dernière chance : une erreur de plus et la partie est perdue.'
const ONE_LEFT = 'Attention : plus qu’une erreur permise.'

describe('règle des erreurs', () => {
  test('le plafond par défaut est de 3 erreurs permises', () => {
    expect(DEFAULT_MAX_MISTAKES).toBe(3)
  })

  describe('remainingMistakes', () => {
    test.each([
      [0, 3, 3],
      [1, 3, 2],
      [2, 3, 1],
      [3, 3, 0],
    ])('avec %i erreur(s) sur %i permises, il en reste %i', (mistakes, max, left) => {
      expect(remainingMistakes(mistakes, max)).toBe(left)
    })

    test('ne descend jamais sous zéro, même au-delà du plafond', () => {
      expect(remainingMistakes(4, 3)).toBe(0)
      expect(remainingMistakes(10, 3)).toBe(0)
    })

    test('suit le plafond fourni', () => {
      expect(remainingMistakes(1, 5)).toBe(4)
    })
  })

  describe('isLost : perdue à la 4e erreur, pas à la 3e', () => {
    test.each([0, 1, 2, 3])('%i erreur(s) sur 3 : la partie continue', (mistakes) => {
      expect(isLost(mistakes, 3)).toBe(false)
    })

    test.each([4, 5, 9])('%i erreurs sur 3 : la partie est perdue', (mistakes) => {
      expect(isLost(mistakes, 3)).toBe(true)
    })

    test('la frontière suit le plafond fourni', () => {
      expect(isLost(5, 5)).toBe(false)
      expect(isLost(6, 5)).toBe(true)
    })
  })

  describe('mistakesLabel', () => {
    test.each([
      [0, '0/3'],
      [2, '2/3'],
      [3, '3/3'],
    ])('%i erreur(s) s’affichent %s', (mistakes, label) => {
      expect(mistakesLabel(mistakes, 3)).toBe(label)
    })

    test('ne dépasse jamais le plafond, même après la défaite', () => {
      expect(mistakesLabel(4, 3)).toBe('3/3')
      expect(mistakesLabel(9, 3)).toBe('3/3')
    })

    test('affiche le plafond fourni', () => {
      expect(mistakesLabel(1, 5)).toBe('1/5')
    })
  })

  describe('mistakesWarning', () => {
    test.each([0, 1])('%i erreur(s) : aucun avertissement', (mistakes) => {
      expect(mistakesWarning(mistakes, 3)).toBeNull()
    })

    test('à 2 erreurs sur 3, il ne reste qu’une erreur permise', () => {
      expect(mistakesWarning(2, 3)).toBe(ONE_LEFT)
    })

    test('à 3 erreurs sur 3, c’est la dernière chance', () => {
      expect(mistakesWarning(3, 3)).toBe(LAST_CHANCE)
    })

    test('au-delà du plafond, l’avertissement reste celui de la dernière chance', () => {
      expect(mistakesWarning(4, 3)).toBe(LAST_CHANCE)
    })

    test('les seuils suivent le plafond fourni', () => {
      expect(mistakesWarning(3, 5)).toBeNull()
      expect(mistakesWarning(4, 5)).toBe(ONE_LEFT)
      expect(mistakesWarning(5, 5)).toBe(LAST_CHANCE)
    })
  })
})
