// Propriétés du classement, vraies pour n'importe quelle liste de joueurs générée par fast-check.
import fc from 'fast-check'
import { describe, expect, test } from 'vitest'
import { rankLeaderboard, type RankableEntry } from './leaderboard'

// Pseudos uniques sans tenir compte de la casse, comme l'index lower(username) en base ; peu de scores
// différents pour provoquer beaucoup d'ex æquo.
const entries = fc.uniqueArray(
  fc.record({
    user_id: fc.uuid(),
    username: fc.stringMatching(/^[A-Za-z0-9_]{3,24}$/),
    best_score: fc.integer({ min: 0, max: 20 }),
  }),
  { selector: (e) => e.username.toLowerCase(), maxLength: 40 },
)

const strictlyBetter = (all: readonly RankableEntry[], score: number) => all.filter((e) => e.best_score > score).length

describe('rankLeaderboard (propriétés)', () => {
  test('garde chaque joueur une seule fois, sans en perdre ni en inventer', () => {
    fc.assert(
      fc.property(entries, (list) => {
        const ids = rankLeaderboard(list).map((e) => e.user_id)
        expect(ids.toSorted()).toEqual(list.map((e) => e.user_id).toSorted())
      }),
    )
  })

  test('le rang d’un joueur vaut 1 + le nombre de joueurs qui ont strictement mieux (1, 1, 3)', () => {
    fc.assert(
      fc.property(entries, (list) => {
        for (const e of rankLeaderboard(list)) expect(e.rank).toBe(1 + strictlyBetter(list, e.best_score))
      }),
    )
  })

  test('les scores décroissent de haut en bas, et deux ex æquo ont toujours le même rang', () => {
    fc.assert(
      fc.property(entries, (list) => {
        const ranked = rankLeaderboard(list)
        for (let i = 1; i < ranked.length; i++) {
          expect(ranked[i].best_score).toBeLessThanOrEqual(ranked[i - 1].best_score)
          if (ranked[i].best_score === ranked[i - 1].best_score) expect(ranked[i].rank).toBe(ranked[i - 1].rank)
          else expect(ranked[i].rank).toBe(i + 1)
        }
      }),
    )
  })

  test('l’ordre de réception des lignes ne change rien au classement affiché', () => {
    fc.assert(
      fc.property(
        entries.chain((list) => fc.tuple(fc.constant(list), fc.shuffledSubarray(list, { minLength: list.length }))),
        ([list, shuffled]) => {
          expect(rankLeaderboard(shuffled)).toEqual(rankLeaderboard(list))
        },
      ),
    )
  })
})
