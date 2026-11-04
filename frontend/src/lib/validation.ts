// zod/mini : même moteur que Zod, API fonctionnelle et ~9 kB au lieu de ~450 kB dans le bundle.
import * as z from 'zod/mini'

// Règles des formulaires, avec des messages qui disent quoi corriger (voir la charte graphique).
// Doivent rester alignées avec la contrainte CHECK de public.profiles.username et avec le backend
// (fr.tikigaming.auth.AuthController).

export const USERNAME_MIN = 3
export const USERNAME_MAX = 24
export const PASSWORD_MIN = 8

// Aides affichées sous les champs (inscription, profil, nouveau mot de passe).
export const USERNAME_HINT = `${USERNAME_MIN} à ${USERNAME_MAX} caractères : lettres sans accent, chiffres et _`
export const PASSWORD_HINT = `${PASSWORD_MIN} caractères minimum`

const USERNAME_CHAR = /[A-Za-z0-9_]/

function describeChar(char: string) {
  return /\s/.test(char) ? 'espace' : char
}

/** Message nommant chaque caractère interdit du pseudo, ou null s'il n'y en a pas. */
function forbiddenCharsMessage(value: string): string | null {
  const forbidden = [...new Set([...value].filter((c) => !USERNAME_CHAR.test(c)).map(describeChar))]
  if (forbidden.length === 0) return null
  const label = forbidden.length === 1 ? 'Caractère non autorisé' : 'Caractères non autorisés'
  return `${label} : ${forbidden.join(', ')} — utilise uniquement des lettres sans accent, des chiffres et _.`
}

export const usernameSchema = z.string().check(
  z.trim(),
  z.minLength(1, 'Choisis un pseudo.'),
  z.superRefine((value, ctx) => {
    const message = forbiddenCharsMessage(value)
    if (message) ctx.issues.push({ code: 'custom', message, input: value })
  }),
  z.minLength(USERNAME_MIN, `Le pseudo doit contenir au moins ${USERNAME_MIN} caractères.`),
  z.maxLength(USERNAME_MAX, `Le pseudo doit contenir au plus ${USERNAME_MAX} caractères.`),
)

export const emailSchema = z.pipe(
  z.string().check(z.trim(), z.minLength(1, 'Indique ton adresse email.')),
  z.email('Cette adresse email n’est pas valide.'),
)

export const passwordSchema = z
  .string()
  .check(z.minLength(PASSWORD_MIN, `Le mot de passe doit contenir au moins ${PASSWORD_MIN} caractères.`))

export const profileSchema = z.object({ username: usernameSchema })
export const signupSchema = z.object({ username: usernameSchema, email: emailSchema, password: passwordSchema })
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().check(z.minLength(1, 'Indique ton mot de passe.')),
})
export const forgotPasswordSchema = z.object({ email: emailSchema })
export const newPasswordSchema = z.object({ password: passwordSchema })

export type FieldErrors = Partial<Record<string, string>>

/** Valide un formulaire : données nettoyées, ou le premier message d'erreur de chaque champ. */
export function validate<T>(schema: z.ZodMiniType<T>, values: unknown): { data: T } | { errors: FieldErrors } {
  const result = schema.safeParse(values)
  if (result.success) return { data: result.data }
  const errors: FieldErrors = {}
  for (const issue of result.error.issues) {
    const field = String(issue.path[0] ?? 'form')
    errors[field] ??= issue.message
  }
  return { errors }
}
