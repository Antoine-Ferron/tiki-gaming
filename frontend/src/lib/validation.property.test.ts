// Propriétés des règles de saisie, vérifiées sur des chaînes générées par fast-check (dont Unicode, espaces,
// caractères de contrôle) : c'est aussi un fuzzing des formulaires d'inscription et de profil.
import fc from 'fast-check'
import { describe, expect, test } from 'vitest'
import { signupSchema, usernameSchema, USERNAME_MAX, USERNAME_MIN, validate } from './validation'

const validUsername = fc.stringMatching(new RegExp(`^[A-Za-z0-9_]{${USERNAME_MIN},${USERNAME_MAX}}$`))

describe('validation des formulaires (propriétés)', () => {
  test('tout pseudo de 3 à 24 lettres sans accent, chiffres ou _ est accepté, espaces autour retirés', () => {
    fc.assert(
      fc.property(validUsername, fc.stringMatching(/^ {0,3}$/), (username, spaces) => {
        expect(usernameSchema.safeParse(`${spaces}${username}${spaces}`)).toEqual({ success: true, data: username })
      }),
    )
  })

  test('un pseudo qui contient un caractère interdit est refusé, et le message nomme ce caractère', () => {
    const forbidden = fc.string({ minLength: 1, maxLength: 1, unit: 'grapheme' }).filter((c) => !/^[\w\s]$/.test(c))
    fc.assert(
      fc.property(validUsername, forbidden, (username, char) => {
        const result = validate(usernameSchema, `${username}${char}`)
        expect(result).toHaveProperty('errors.form')
        expect('errors' in result && result.errors.form).toContain(char)
      }),
    )
  })

  test('fuzzing : n’importe quelle saisie donne des données ou des messages, jamais une exception', () => {
    const anyForm = fc.record({ username: fc.anything(), email: fc.anything(), password: fc.anything() })
    fc.assert(
      fc.property(anyForm, (form) => {
        const result = validate(signupSchema, form)
        if ('errors' in result) {
          for (const message of Object.values(result.errors)) expect(message).toMatch(/\S/)
        } else {
          expect(Object.keys(result.data).toSorted()).toEqual(['email', 'password', 'username'])
        }
      }),
    )
  })
})
