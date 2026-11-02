import type { LeaderboardEntry } from '@/games/types'

export function Leaderboard({ entries, currentUserId }: { entries: LeaderboardEntry[]; currentUserId?: string }) {
  if (entries.length === 0) return <p className="muted">Aucun score pour l'instant.</p>
  return (
    <ol className="leaderboard">
      {entries.map((e, i) => (
        <li key={e.user_id} className={e.user_id === currentUserId ? 'me' : undefined}>
          <span className="rank">{i + 1}</span>
          <span className="name">{e.username}</span>
          <span className="score">{e.best_score}</span>
        </li>
      ))}
    </ol>
  )
}
