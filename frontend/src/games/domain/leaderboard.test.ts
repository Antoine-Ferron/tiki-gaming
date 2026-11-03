import { describe, expect, test } from 'vitest'
import { rankLeaderboard, type RankableEntry } from './leaderboard'

const entry = (username: string, best_score: number): RankableEntry => ({
  user_id: `id-${username}`,
  username,
  best_score,
})

describe('rankLeaderboard', () => {
  test('classe un tableau vide sans erreur', () => {
    expect(rankLeaderboard([])).toEqual([])
  })

  test('trie par meilleur score décroissant et numérote à partir de 1', () => {
    const ranked = rankLeaderboard([entry('bob', 10), entry('alice', 30), entry('carl', 20)])

    expect(ranked.map((e) => [e.rank, e.username])).toEqual([
      [1, 'alice'],
      [2, 'carl'],
      [3, 'bob'],
    ])
  })

  test('donne le même rang aux ex æquo et saute les rangs suivants (1, 1, 3)', () => {
    const ranked = rankLeaderboard([entry('bob', 50), entry('alice', 50), entry('carl', 40)])

    expect(ranked.map((e) => e.rank)).toEqual([1, 1, 3])
  })

  test('départage l’affichage des ex æquo par pseudo, sans tenir compte de la casse', () => {
    const ranked = rankLeaderboard([entry('zoe', 5), entry('Bob', 5), entry('alice', 5)])

    expect(ranked.map((e) => e.username)).toEqual(['alice', 'Bob', 'zoe'])
  })

  test('un ex æquo en fin de classement partage le rang du précédent', () => {
    const ranked = rankLeaderboard([entry('a', 3), entry('b', 2), entry('c', 1), entry('d', 1)])

    expect(ranked.map((e) => e.rank)).toEqual([1, 2, 3, 3])
  })

  test('gère un score nul ou négatif comme les autres', () => {
    const ranked = rankLeaderboard([entry('a', 0), entry('b', -1), entry('c', 0)])

    expect(ranked.map((e) => [e.rank, e.username])).toEqual([
      [1, 'a'],
      [1, 'c'],
      [3, 'b'],
    ])
  })

  test('ne modifie pas le tableau reçu', () => {
    const input = [entry('bob', 1), entry('alice', 2)]

    rankLeaderboard(input)

    expect(input.map((e) => e.username)).toEqual(['bob', 'alice'])
  })

  test('conserve les autres champs de chaque entrée', () => {
    const [first] = rankLeaderboard([{ ...entry('alice', 1), games_played: 4 }])

    expect(first).toMatchObject({ user_id: 'id-alice', games_played: 4, rank: 1 })
  })
})
