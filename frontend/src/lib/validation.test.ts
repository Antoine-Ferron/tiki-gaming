import { describe, expect, it } from 'vitest'
import { emailSchema, passwordSchema, signupSchema, usernameSchema, validate } from './validation'

function firstError(schema: Parameters<typeof validate>[0], value: unknown) {
  const result = schema.safeParse(value)
  return result.success ? null : result.error.issues[0].message
}

describe('usernameSchema', () => {
  it('accepte lettres, chiffres et _', () => {
    expect(usernameSchema.parse('Anathos_42')).toBe('Anathos_42')
  })

  it('retire les espaces autour du pseudo', () => {
    expect(usernameSchema.parse('  Anathos  ')).toBe('Anathos')
  })

  it("nomme le caractère interdit (l'apostrophe)", () => {
    expect(firstError(usernameSchema, "Anathos'")).toBe(
      "Caractère non autorisé : ' — utilise uniquement des lettres sans accent, des chiffres et _.",
    )
  })

  it('liste chaque caractère interdit une seule fois, espace compris', () => {
    expect(firstError(usernameSchema, 'Zoé la-zoé')).toBe(
      'Caractères non autorisés : é, espace, - — utilise uniquement des lettres sans accent, des chiffres et _.',
    )
  })

  it('exige 3 caractères minimum', () => {
    expect(firstError(usernameSchema, 'ab')).toBe('Le pseudo doit contenir au moins 3 caractères.')
  })

  it('limite à 24 caractères', () => {
    expect(firstError(usernameSchema, 'a'.repeat(25))).toBe('Le pseudo doit contenir au plus 24 caractères.')
  })

  it('demande un pseudo quand le champ est vide', () => {
    expect(firstError(usernameSchema, '   ')).toBe('Choisis un pseudo.')
  })
})

describe('emailSchema', () => {
  it('demande un email quand le champ est vide', () => {
    expect(firstError(emailSchema, '')).toBe('Indique ton adresse email.')
  })

  it('refuse un email mal formé', () => {
    expect(firstError(emailSchema, 'joueur@')).toBe('Cette adresse email n’est pas valide.')
  })
})

describe('passwordSchema', () => {
  it('exige 8 caractères minimum', () => {
    expect(firstError(passwordSchema, 'court')).toBe('Le mot de passe doit contenir au moins 8 caractères.')
  })
})

describe('validate', () => {
  it('renvoie les données nettoyées quand tout est valide', () => {
    expect(validate(signupSchema, { username: ' Anathos ', email: 'a@b.fr', password: '12345678' })).toEqual({
      data: { username: 'Anathos', email: 'a@b.fr', password: '12345678' },
    })
  })

  it('renvoie le premier message de chaque champ en erreur', () => {
    expect(validate(signupSchema, { username: "Anathos'", email: 'a@b.fr', password: 'court' })).toEqual({
      errors: {
        username: "Caractère non autorisé : ' — utilise uniquement des lettres sans accent, des chiffres et _.",
        password: 'Le mot de passe doit contenir au moins 8 caractères.',
      },
    })
  })
})
