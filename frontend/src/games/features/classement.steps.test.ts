import { fileURLToPath } from 'node:url'
import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber'
import { expect } from 'vitest'
import { rankLeaderboard, type Ranked } from '../domain/leaderboard'
import type { LeaderboardEntry } from '../types'
import { FakeScores } from '../testing/fakes'

// Étapes liées au domaine et au fake du dépôt de scores, pas à l'interface : le scénario survit à une refonte de l'UI.
const feature = await loadFeature(fileURLToPath(new URL('./classement.feature', import.meta.url)), { language: 'fr' })

describeFeature(feature, ({ Scenario }) => {
  const steps = ({ Given, When, Then }: Parameters<Parameters<typeof Scenario>[1]>[0]) => {
    let entries: LeaderboardEntry[] = []
    let ranked: Ranked<LeaderboardEntry>[] = []

    Given('les parties suivantes sur le Clicker', async (_, games: { joueur: string; score: string }[]) => {
      const scores = new FakeScores()
      for (const { joueur, score } of games) {
        scores.rows.push({ gameSlug: 'clicker', userId: joueur, username: joueur, score: Number(score), metadata: {} })
      }
      entries = await scores.leaderboard('clicker', 10)
    })
    When('le classement est calculé', () => {
      ranked = rankLeaderboard(entries)
    })
    Then('le classement affiché est', (_, table: { rang: string; joueur: string; 'meilleur score': string }[]) => {
      expect(
        ranked.map((e) => ({ rang: String(e.rank), joueur: e.username, 'meilleur score': String(e.best_score) })),
      ).toEqual(table)
    })
  }

  Scenario('Le meilleur score de chaque joueur est classé du plus haut au plus bas', steps)
  Scenario('Des ex æquo partagent leur rang et le rang suivant est sauté', steps)
})
