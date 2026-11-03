// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import type { LeaderboardEntry } from '@/games/types'
import { Leaderboard } from './Leaderboard'

afterEach(cleanup)

const entry = (user_id: string, username: string, best_score: number): LeaderboardEntry => ({
  game_slug: 'clicker',
  user_id,
  username,
  best_score,
  avatar_url: null,
  games_played: 1,
  last_played_at: '2026-11-03T00:00:00Z',
})

test('affiche un message quand personne n’a encore joué', () => {
  render(<Leaderboard entries={[]} />)

  expect(screen.getByText("Aucun score pour l'instant.")).toBeTruthy()
})

test('affiche le rang partagé des ex æquo et met le joueur courant en avant', () => {
  render(
    <Leaderboard
      entries={[entry('b', 'bob', 50), entry('a', 'alice', 50), entry('c', 'carl', 10)]}
      currentUserId="c"
    />,
  )

  const rows = screen.getAllByRole('listitem').map((li) => [li.querySelector('.rank')?.textContent, li.className])
  expect(rows).toEqual([
    ['1', ''],
    ['1', ''],
    ['3', 'me'],
  ])
})
