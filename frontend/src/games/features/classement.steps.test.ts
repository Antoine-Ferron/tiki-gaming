import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber'
import { expect } from 'vitest'
import { rankLeaderboard, type RankableEntry, type Ranked } from '../domain/leaderboard'
import { createGameContext } from '../sdk'
import { FakeScores, fakeDeps } from '../testing/fakes'
import type { LeaderboardEntry } from '../types'

// Étapes liées directement au domaine et au SDK (avec ses fakes) : aucune dépendance à l'interface.
const feature = await loadFeature('src/games/features/classement.feature', { language: 'fr' })

type Row = Record<string, string>
const game = { slug: 'clicker' }

describeFeature(feature, ({ Scenario }) => {
  for (const title of [
    'Les joueurs sont classés du meilleur score au moins bon',
    'Des ex æquo partagent le même rang et le rang suivant est sauté',
  ]) {
    Scenario(title, ({ Given, When, Then }) => {
      let entries: RankableEntry[] = []
      let ranked: Ranked<RankableEntry>[] = []

      Given('les meilleurs scores suivants', (_, table: Row[]) => {
        entries = table.map((r) => ({ user_id: r.joueur, username: r.joueur, best_score: Number(r.score) }))
      })
      When('le classement est calculé', () => {
        ranked = rankLeaderboard(entries)
      })
      Then('le classement est', (_, table: Row[]) => {
        expect(ranked.map((e) => ({ rang: String(e.rank), joueur: e.username }))).toEqual(table)
      })
    })
  }

  Scenario('Seul le meilleur score de chaque joueur compte', ({ Given, And, When, Then }) => {
    const repos = new Map<string, FakeScores>()
    const rows: FakeScores['rows'] = []
    let board: LeaderboardEntry[] = []

    async function play(username: string, scores: number[]) {
      const player = { id: `id-${username}`, username }
      const repo = new FakeScores(player)
      // Un seul « serveur » : tous les joueurs écrivent dans la même table de scores.
      ;(repo as { rows: FakeScores['rows'] }).rows = rows
      repos.set(username, repo)
      const ctx = createGameContext(game, player, fakeDeps({ scores: repo }))
      for (const score of scores) await ctx.submitScore(score)
    }

    Given('"alice" a joué des parties à 10, 30 et 20 points', () => play('alice', [10, 30, 20]))
    And('"bob" a joué une partie à 25 points', () => play('bob', [25]))
    When('le classement du jeu est affiché', async () => {
      board = await repos.get('alice')!.leaderboard(game.slug, 10)
    })
    Then('"alice" est première avec 30 points et 3 parties jouées', () => {
      expect(board[0]).toMatchObject({ username: 'alice', best_score: 30, games_played: 3 })
    })
    And('"bob" est deuxième avec 25 points', () => {
      expect(board[1]).toMatchObject({ username: 'bob', best_score: 25 })
    })
  })
})
