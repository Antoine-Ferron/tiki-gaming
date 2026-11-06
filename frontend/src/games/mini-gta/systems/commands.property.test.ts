// Fuzzing du chat (fast-check) : n'importe quelle saisie donne une commande, un message ou une complétion,
// jamais une exception.
import fc from 'fast-check'
import { describe, expect, test } from 'vitest'
import { complete, parse } from './commands'

const line = fc.oneof(
  fc.string(),
  fc.string().map((s) => `/${s}`),
  fc.string({ unit: 'binary' }),
)

describe('chat (fuzzing)', () => {
  test('une saisie sans « / » est un message ordinaire, une saisie avec « / » une commande', () => {
    fc.assert(
      fc.property(line, (typed) => {
        // Act
        const cmd = parse(typed)

        // Assert
        expect(cmd === null).toBe(!typed.trim().startsWith('/'))
        if (cmd) expect(typeof cmd.name).toBe('string')
      }),
    )
  })

  test('la complétion ne lève jamais d’exception et ne raccourcit jamais une commande', () => {
    fc.assert(
      fc.property(line, (typed) => {
        // Act
        const { text, options } = complete(typed)

        // Assert
        expect(typeof text).toBe('string')
        expect(Array.isArray(options)).toBe(true)
        if (!typed.startsWith('/')) expect(text).toBe(typed)
      }),
    )
  })
})
