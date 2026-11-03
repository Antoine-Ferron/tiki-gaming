import { describe, expect, test } from 'vitest'
import { DIFFICULTIES, formatTime } from './logic'

describe('DIFFICULTIES', () => {
  test('nomme les trois niveaux', () => {
    expect(Object.values(DIFFICULTIES).map((d) => d.label)).toEqual(['Facile', 'Moyen', 'Difficile'])
  })
})

describe('formatTime', () => {
  test.each([
    [0, '0:00'],
    [5, '0:05'],
    [60, '1:00'],
    [125, '2:05'],
    [3600, '60:00'],
  ])('%i s → %s', (seconds, expected) => {
    expect(formatTime(seconds)).toBe(expected)
  })
})
