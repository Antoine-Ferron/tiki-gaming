import { useCallback, useEffect, useState } from 'react'
import { Leaderboard } from '@/components/Leaderboard'
import type { GameProps, LeaderboardEntry } from '../types'
import { LevelPicker } from './components/LevelPicker'
import { LevelPlayer } from './components/LevelPlayer'
import { getLevel, levels } from './domain/levels'
import type { BestScores } from './domain/progress'
import { loadBest } from './services/progress'
import './rush-hour.css'

/** Jeu Rush Hour : écran de choix des niveaux, ou partie en cours, et classement à côté. */
export default function RushHourGame({ ctx }: GameProps) {
  const [best, setBest] = useState<BestScores | null>(null)
  const [levelId, setLevelId] = useState<number | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [message, setMessage] = useState<string | null>(null)

  const loadLeaderboard = useCallback(() => {
    ctx
      .getLeaderboard(10)
      .then(setLeaderboard)
      .catch((e: Error) => setMessage(e.message))
  }, [ctx])

  useEffect(() => {
    loadLeaderboard()
    loadBest(ctx)
      .then(setBest)
      .catch((e: Error) => {
        setBest({})
        setMessage(e.message)
      })
  }, [ctx, loadLeaderboard])

  function completed(next: BestScores) {
    setBest(next)
    loadLeaderboard()
  }

  const hasNext = levelId !== null && levelId < levels.length

  return (
    <div className="rush-hour">
      <div className="card">
        {best === null ? (
          <p className="muted">Chargement…</p>
        ) : levelId === null ? (
          <LevelPicker best={best} onPick={setLevelId} />
        ) : (
          <LevelPlayer
            key={levelId}
            ctx={ctx}
            level={getLevel(levelId)}
            onBack={() => setLevelId(null)}
            onNext={hasNext ? () => setLevelId(levelId + 1) : undefined}
            onCompleted={completed}
          />
        )}
        {ctx.isGuest && <p className="muted">Connecte-toi pour apparaître au classement.</p>}
        {message && <p className="error">{message}</p>}
      </div>
      <div className="card">
        <h2>Classement</h2>
        <Leaderboard entries={leaderboard} currentUserId={ctx.player?.id} />
      </div>
    </div>
  )
}
