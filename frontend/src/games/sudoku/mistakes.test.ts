import { describe, expect, test } from 'vitest'
import { DEFAULT_MAX_MISTAKES, isLost, mistakesLabel, mistakesWarning, remainingMistakes } from './mistakes'

describe('règle des erreurs', () => {
  test('le plafond par défaut existe', () => {
    expect(DEFAULT_MAX_MISTAKES).toBeDefined()
  })

  test('remainingMistakes renvoie un nombre', () => {
    expect(typeof remainingMistakes(0, 3)).toBe('number')
    expect(typeof remainingMistakes(5, 3)).toBe('number')
  })

  test('isLost renvoie un booléen', () => {
    expect(typeof isLost(1, 3)).toBe('boolean')
    expect(typeof isLost(4, 3)).toBe('boolean')
  })

  test('mistakesLabel renvoie du texte', () => {
    expect(mistakesLabel(2, 3)).toBeTruthy()
    expect(mistakesLabel(9, 3)).toBeTruthy()
  })

  test('mistakesWarning gère tous les cas', () => {
    expect(mistakesWarning(0, 3)).toBeDefined()
    expect(mistakesWarning(2, 3)).toBeDefined()
    expect(mistakesWarning(3, 3)).toBeDefined()
  })
})
