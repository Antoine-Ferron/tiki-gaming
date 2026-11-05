import type { Page } from '@playwright/test'

export type LeaderboardRow = { user_id: string; username: string; best_score: number }
type MastermindMockGame = {
  id: string
  status: string
  attemptsUsed: number
  attemptsRemaining: number
  history: Array<{ guess: string[]; feedback: { exact: number; misplaced: number } }>
  secret: null
  score: number
}

/** Simule le backend (visiteur non connecté) et l'API REST Supabase ; tout autre appel externe est refusé. */
export async function mockPlatform(page: Page, leaderboard: LeaderboardRow[] | { status: number } = []) {
  const gameId = 'e2e-mastermind-game'
  const newGame = () => ({
    id: gameId,
    status: 'IN_PROGRESS',
    attemptsUsed: 0,
    attemptsRemaining: 10,
    history: [],
    secret: null,
    score: 0,
  })
  let game: MastermindMockGame = newGame()

  await page.route('**/api/auth/session', (route) => route.fulfill({ json: { user: null } }))
  await page.route('**/api/games/mastermind', async (route) => {
    if (route.request().method() === 'POST') {
      game = newGame()
      return route.fulfill({ json: game })
    }
    return route.fallback()
  })
  await page.route('**/api/games/mastermind/**', async (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ json: game })
    if (route.request().method() !== 'POST') return route.fallback()
    if (route.request().url().endsWith('/restart')) {
      game = newGame()
      return route.fulfill({ json: game })
    }
    game = {
      ...game,
      attemptsUsed: game.attemptsUsed + 1,
      attemptsRemaining: game.attemptsRemaining - 1,
      history: [...game.history, { guess: ['red', 'blue', 'green', 'yellow'], feedback: { exact: 0, misplaced: 0 } }],
    }
    return route.fulfill({ json: game })
  })
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
