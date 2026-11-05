// Fuzzing de toGameError : supabase-js, fetch ou un jeu peuvent lever n'importe quoi (objet partiel, chaîne,
// null, valeur circulaire…). La traduction ne doit jamais planter ni montrer un message technique au joueur.
import fc from 'fast-check'
import { describe, expect, test, vi } from 'vitest'
import { GameError, MESSAGES, toGameError } from './errors'

vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn() } }))

// Ce qui ressemble à une erreur réseau ou Postgres, mélangé à des valeurs quelconques.
const errorLike = fc.record(
  {
    code: fc.oneof(fc.constantFrom('42501', '23514', '23503', 'PGRST301', 'XX000'), fc.anything()),
    message: fc.oneof(fc.constantFrom('Failed to fetch', 'NetworkError when attempting'), fc.anything()),
    status: fc.oneof(fc.integer({ min: 0, max: 599 }), fc.anything()),
  },
  { requiredKeys: [] },
)
const anyError = fc.oneof(fc.anything(), errorLike)
const playerMessages = new Set(Object.values(MESSAGES))

describe('toGameError (fuzzing)', () => {
  test('renvoie toujours une GameError dont le message est un des messages prévus pour le joueur', () => {
    fc.assert(
      fc.property(anyError, fc.option(fc.integer({ min: 0, max: 599 }), { nil: undefined }), (err, status) => {
        const result = toGameError(err, status)
        expect(result).toBeInstanceOf(GameError)
        expect(playerMessages.has(result.message)).toBe(true)
      }),
    )
  })

  test('une erreur déjà traduite est renvoyée telle quelle', () => {
    const codes = fc.constantFrom(...(Object.keys(MESSAGES) as (keyof typeof MESSAGES)[]))
    fc.assert(
      fc.property(codes, fc.string(), (code, message) => {
        const original = new GameError(code, message)
        expect(toGameError(original)).toBe(original)
      }),
    )
  })

  test('un statut 5xx ou une coupure (0) est toujours une erreur réseau, que l’action peut retenter', () => {
    const serverDown = fc.oneof(fc.constant(0), fc.integer({ min: 500, max: 599 }))
    fc.assert(
      fc.property(serverDown, (status) => {
        const result = toGameError({}, status)
        expect(result.code).toBe('network')
        expect(result.retryable).toBe(true)
      }),
    )
  })
})
