import { useCallback, useEffect, useReducer, useState } from 'react'
import { Leaderboard } from '@/components/Leaderboard'
import type { GameProps, LeaderboardEntry } from '../types'
import { browserClock } from './browserClock'
import { Board } from './components/Board'
import { parseBoard } from './domain/board'
import { getLevel } from './domain/levels'
import { GameSession } from './domain/session'
import { solve } from './domain/solver'
import { completeLevel } from './services/completeLevel'
import './rush-hour.css'

const LEVEL = getLevel(1)

function formatTime(ms: number) {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** Écran de jeu : affiche la partie et transmet les actions du joueur au domaine (aucune règle ici). */
export default function RushHourGame({ ctx }: GameProps) {
  const [session] = useState(() => new GameSession(LEVEL.map, browserClock))
  const [optimal] = useState(() => solve(parseBoard(LEVEL.map))?.length ?? 0)
  const [, refresh] = useReducer((n: number) => n + 1, 0)
  const [result, setResult] = useState<number | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])

  const loadLeaderboard = useCallback(() => {
    ctx
      .getLeaderboard(10)
      .then(setLeaderboard)
      .catch((e: Error) => setMessage(e.message))
  }, [ctx])

  useEffect(loadLeaderboard, [loadLeaderboard])

  // Le chrono affiché avance chaque seconde tant que la partie n'est pas gagnée.
  useEffect(() => {
    if (session.solved) return
    const id = setInterval(refresh, 1000)
    return () => clearInterval(id)
  })

  async function play(id: string, delta: number) {
    session.move(id, delta)
    refresh()
    if (!session.solved) return
    const run = { level: LEVEL.id, optimal, moves: session.moves, hintsUsed: 0, durationMs: session.elapsedMs }
    try {
      const { score } = await completeLevel(ctx, run)
      setResult(score)
      loadLeaderboard()
    } catch (e) {
      setMessage((e as Error).message)
    }
  }

  function restart() {
    session.reset()
    setResult(null)
    setMessage(null)
    refresh()
  }

  function undo() {
    session.undo()
    refresh()
  }

  return (
    <div className="rush-hour">
      <div className="card">
        <h2>Niveau {LEVEL.id}</h2>
        <div className="rush-hour-stats">
          <span>
            Coups : {session.moveCount} (min. {optimal})
          </span>
          <span>Temps : {formatTime(session.elapsedMs)}</span>
        </div>
        <Board board={session.board} locked={session.solved} onMove={play} />
        {result !== null && (
          <p className="result">
            Bravo ! {result} points en {session.moveCount} coups
          </p>
        )}
        <div className="rush-hour-actions">
          {!session.solved && (
            <button type="button" className="small" onClick={undo} disabled={session.moveCount === 0}>
              Annuler
            </button>
          )}
          <button type="button" className="small" onClick={restart}>
            {session.solved ? 'Rejouer' : 'Recommencer'}
          </button>
        </div>
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
