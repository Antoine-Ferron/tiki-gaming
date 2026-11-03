import { useEffect, useReducer, useState } from 'react'
import { browserClock } from '../browserClock'
import { type Board as BoardModel, type Move, parseBoard } from '../domain/board'
import { GameSession } from '../domain/session'
import { solve } from '../domain/solver'
import { Board } from './Board'
import { vehicleLabel } from './vehicleLabel'

function formatTime(ms: number) {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** « Camion C de 2 cases vers le bas » : l'indice dit quel véhicule déplacer, dans quel sens, de combien. */
function describeHint(board: BoardModel, move: Move) {
  const v = board.vehicles.find((x) => x.id === move.id)!
  const forward = move.delta > 0
  const direction = v.orientation === 'H' ? (forward ? 'la droite' : 'la gauche') : forward ? 'le bas' : 'le haut'
  const n = Math.abs(move.delta)
  return `${vehicleLabel(v)} de ${n} case${n > 1 ? 's' : ''} vers ${direction}`
}

/** Ce qu'une partie gagnée transmet pour calculer et enregistrer le score. */
export type FinishedRun = { optimal: number; moves: Move[]; hintsUsed: number; durationMs: number }

type LevelPlayerProps = {
  title: string
  map: string[]
  /** Enregistre la partie gagnée et renvoie son score. */
  complete: (run: FinishedRun) => Promise<number>
  onBack: () => void
  /** Bouton affiché après la victoire (« Niveau suivant », « Nouveau plateau »), absent s'il n'y a pas de suite. */
  next?: { label: string; onClick: () => void }
}

/** Une partie sur un plateau : affiche la partie et transmet les actions du joueur au domaine (aucune règle ici). */
export function LevelPlayer({ title, map, complete, onBack, next }: LevelPlayerProps) {
  const [session] = useState(() => new GameSession(map, browserClock))
  const [optimal] = useState(() => solve(parseBoard(map))?.length ?? 0)
  const [, refresh] = useReducer((n: number) => n + 1, 0)
  const [result, setResult] = useState<number | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [hint, setHint] = useState<Move | null>(null)

  // Le chrono affiché avance chaque seconde tant que la partie n'est pas gagnée.
  useEffect(() => {
    if (session.solved) return
    const id = setInterval(refresh, 1000)
    return () => clearInterval(id)
  })

  async function play(id: string, delta: number) {
    session.move(id, delta)
    setHint(null)
    refresh()
    if (!session.solved) return
    const run = { optimal, moves: session.moves, hintsUsed: session.hintsUsed, durationMs: session.elapsedMs }
    try {
      setResult(await complete(run))
    } catch (e) {
      setMessage((e as Error).message)
    }
  }

  function restart() {
    session.reset()
    setHint(null)
    setResult(null)
    setMessage(null)
    refresh()
  }

  function undo() {
    session.undo()
    setHint(null)
    refresh()
  }

  return (
    <>
      <button type="button" className="link" onClick={onBack}>
        ← Niveaux
      </button>
      <h2>{title}</h2>
      <div className="rush-hour-stats">
        <span>
          Coups : {session.moveCount} (min. {optimal})
        </span>
        <span>Temps : {formatTime(session.elapsedMs)}</span>
      </div>
      <Board board={session.board} locked={session.solved} highlight={hint?.id} onMove={play} />
      {hint && <p className="muted">Indice : {describeHint(session.board, hint)}</p>}
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
        {!session.solved && (
          <button type="button" className="small" onClick={() => setHint(session.hint())}>
            Indice (−200 points)
          </button>
        )}
        <button type="button" className="small" onClick={restart}>
          {session.solved ? 'Rejouer' : 'Recommencer'}
        </button>
        {session.solved && next && (
          <button type="button" className="small" onClick={next.onClick}>
            {next.label}
          </button>
        )}
      </div>
      {message && <p className="error">{message}</p>}
    </>
  )
}
