import { useEffect, useState } from 'react'
import { Leaderboard } from '@/components/Leaderboard'
import type { GameProps, LeaderboardEntry } from '../types'
import { Board } from './components/Board'
import { parseBoard } from './domain/board'
import { getLevel } from './domain/levels'
import './rush-hour.css'

/**
 * Squelette du jeu : affiche le niveau 1 et le classement.
 * Les règles (déplacements, victoire, score) viendront dans ./domain, écrites en TDD.
 */
export default function RushHourGame({ ctx }: GameProps) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const level = getLevel(1)
  const board = parseBoard(level.map)

  useEffect(() => {
    ctx
      .getLeaderboard(10)
      .then(setLeaderboard)
      .catch((e) => setError(e.message))
  }, [ctx])

  return (
    <div className="rush-hour">
      <div className="card">
        <h2>Niveau {level.id}</h2>
        <Board board={board} />
        {ctx.isGuest && <p className="muted">Connecte-toi pour apparaître au classement.</p>}
        {error && <p className="error">{error}</p>}
      </div>
      <div className="card">
        <h2>Classement</h2>
        <Leaderboard entries={leaderboard} currentUserId={ctx.player?.id} />
      </div>
    </div>
  )
}
