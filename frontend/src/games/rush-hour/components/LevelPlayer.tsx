import { useEffect, useReducer, useState } from 'react'
import type { GameContext } from '../../types'
import { browserClock } from '../browserClock'
import { parseBoard } from '../domain/board'
import type { Level } from '../domain/levels'
import type { BestScores } from '../domain/progress'
import { GameSession } from '../domain/session'
import { solve } from '../domain/solver'
import { completeLevel } from '../services/completeLevel'
import { Board } from './Board'

function formatTime(ms: number) {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

type LevelPlayerProps = {
  ctx: GameContext
  level: Level
  onBack: () => void
  /** Absent pour le dernier niveau. */
  onNext?: () => void
  onCompleted: (best: BestScores) => void
}

/** Une partie sur un niveau : affiche la partie et transmet les actions du joueur au domaine (aucune règle ici). */
export function LevelPlayer({ ctx, level, onBack, onNext, onCompleted }: LevelPlayerProps) {
  const [session] = useState(() => new GameSession(level.map, browserClock))
  const [optimal] = useState(() => solve(parseBoard(level.map))?.length ?? 0)
  const [, refresh] = useReducer((n: number) => n + 1, 0)
  const [result, setResult] = useState<number | null>(null)
  const [message, setMessage] = useState<string | null>(null)

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
    const run = { level: level.id, optimal, moves: session.moves, hintsUsed: 0, durationMs: session.elapsedMs }
    try {
      const { score, best } = await completeLevel(ctx, run)
      setResult(score)
      onCompleted(best)
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
    <>
      <button type="button" className="link" onClick={onBack}>
        ← Niveaux
      </button>
      <h2>Niveau {level.id}</h2>
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
        {session.solved && onNext && (
          <button type="button" className="small" onClick={onNext}>
            Niveau suivant
          </button>
        )}
      </div>
      {message && <p className="error">{message}</p>}
    </>
  )
}
