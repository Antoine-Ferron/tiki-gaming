import { describe, expect, test } from 'vitest'
import { checkScore, DEFAULT_MAX_SCORE } from './score'

describe('checkScore', () => {
  // Partition valide, frontière basse : -1 (refusé), 0, 1
  test.each([0, 1, 42])('accepte %d', (score) => {
    expect(checkScore(score)).toBeNull()
  })

  test('refuse -1, juste sous la frontière basse', () => {
    expect(checkScore(-1)).toBe('Un score ne peut pas être négatif.')
  })

  // Frontière haute avec une limite déclarée par le jeu : max - 1, max, max + 1
  test.each([
    [99, null],
    [100, null],
    [101, 'Score refusé : 100 au maximum pour ce jeu.'],
  ])('avec max = 100, %d donne %s', (score, expected) => {
    expect(checkScore(score, { max: 100 })).toBe(expected)
  })

  test('sans limite déclarée, la frontière haute est celle des entiers sûrs', () => {
    expect(checkScore(DEFAULT_MAX_SCORE)).toBeNull()
    expect(checkScore(DEFAULT_MAX_SCORE + 2)).not.toBeNull()
  })

  // Partition invalide : pas un entier
  test.each([1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])('refuse %d', (score) => {
    expect(checkScore(score)).toBe('Un score doit être un nombre entier.')
  })

  test('vérifie l’entier avant les bornes', () => {
    expect(checkScore(-0.5)).toBe('Un score doit être un nombre entier.')
  })
})
