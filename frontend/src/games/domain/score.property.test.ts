// Propriétés de checkScore vérifiées sur des centaines d'entrées générées par fast-check, en complément des valeurs
// limites de score.test.ts. En cas d'échec, fast-check réduit l'entrée au plus petit contre-exemple et affiche la
// graine (seed) pour rejouer exactement le même tirage.
import fc from 'fast-check'
import { describe, test } from 'vitest'
import { checkScore, DEFAULT_MAX_SCORE } from './score'

// Un maximum de jeu, et un score tiré sous ce maximum ou au-dessus.
const limit = fc.integer({ min: 0, max: 1_000_000 })

describe('checkScore (propriétés)', () => {
  test('accepte tout entier entre 0 et le maximum du jeu', () => {
    fc.assert(
      fc.property(
        limit.chain((max) => fc.tuple(fc.constant(max), fc.integer({ min: 0, max }))),
        ([max, score]) => checkScore(score, { max }) === null,
      ),
    )
  })

  test('refuse tout entier au-dessus du maximum, en citant ce maximum', () => {
    fc.assert(
      fc.property(limit, fc.integer({ min: 1, max: 1_000_000 }), (max, excess) => {
        return checkScore(max + excess, { max }) === `Score refusé : ${max} au maximum pour ce jeu.`
      }),
    )
  })

  test('refuse tout entier négatif, quel que soit le maximum', () => {
    fc.assert(
      fc.property(fc.integer({ min: Number.MIN_SAFE_INTEGER, max: -1 }), fc.option(limit), (score, max) => {
        return checkScore(score, { max: max ?? undefined }) === 'Un score ne peut pas être négatif.'
      }),
    )
  })

  test('refuse tout nombre non entier (décimaux, NaN, infinis) avant de regarder les bornes', () => {
    const notInteger = fc.double().filter((n) => !Number.isInteger(n))
    fc.assert(
      fc.property(notInteger, fc.option(limit), (score, max) => {
        return checkScore(score, { max: max ?? undefined }) === 'Un score doit être un nombre entier.'
      }),
    )
  })

  test('fuzzing : ne lève jamais d’exception et renvoie null ou un message, pour n’importe quel nombre', () => {
    fc.assert(
      fc.property(fc.oneof(fc.double(), fc.integer()), fc.option(fc.double()), (score, max) => {
        const result = checkScore(score, { max: max ?? undefined })
        return result === null || (typeof result === 'string' && result.length > 0)
      }),
    )
  })

  test('sans maximum déclaré, tout entier sûr positif est accepté', () => {
    fc.assert(fc.property(fc.integer({ min: 0, max: DEFAULT_MAX_SCORE }), (score) => checkScore(score) === null))
  })
})
