import type { Page } from '@playwright/test'

export type LeaderboardRow = { user_id: string; username: string; best_score: number }

/** Simule le backend (visiteur non connecté) et l'API REST Supabase ; tout autre appel externe est refusé. */
export async function mockPlatform(page: Page, leaderboard: LeaderboardRow[] | { status: number } = []) {
  await page.route('**/api/auth/session', (route) => route.fulfill({ json: { user: null } }))
  await page.route('https://supabase.e2e.test/**', (route) => {
    const url = new URL(route.request().url())
    if (url.pathname === '/rest/v1/leaderboard') {
      if ('status' in leaderboard)
        return route.fulfill({ status: leaderboard.status, json: { message: 'indisponible' } })
      return route.fulfill({
        json: leaderboard.map((row) => ({
          game_slug: url.searchParams.get('game_slug')?.replace('eq.', ''),
          avatar_url: null,
          games_played: 1,
          last_played_at: '2026-11-03T00:00:00Z',
          ...row,
        })),
      })
    }
    return route.abort()
  })
}
