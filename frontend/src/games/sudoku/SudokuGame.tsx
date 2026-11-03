import { useCallback, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Leaderboard } from '@/components/Leaderboard'
import type { GameProps, LeaderboardEntry } from '../types'
import {
  DIFFICULTIES,
  computeScore,
  findConflicts,
  formatTime,
  generatePuzzle,
  type Difficulty,
  type Grid,
} from './logic'
import './sudoku.css'

type Save = {
  difficulty: Difficulty
  puzzle: Grid
  solution: Grid
  values: Grid
  seconds: number
  mistakes: number
}

type Phase = 'idle' | 'playing' | 'over'

export default function SudokuGame({ ctx }: GameProps) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [difficulty, setDifficulty] = useState<Difficulty>('easy')
  const [puzzle, setPuzzle] = useState<Grid>([])
  const [solution, setSolution] = useState<Grid>([])
  const [values, setValues] = useState<Grid>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [seconds, setSeconds] = useState(0)
  const [mistakes, setMistakes] = useState(0)
  const [score, setScore] = useState(0)
  const [hasSave, setHasSave] = useState(false)
  const [best, setBest] = useState<number | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const cellRefs = useRef<(HTMLButtonElement | null)[]>([])

  const refreshScores = useCallback(() => {
    ctx
      .getLeaderboard(10)
      .then(setLeaderboard)
      .catch((e) => setError(e.message))
    ctx
      .getMyBest()
      .then((b) => setBest(b?.best_score ?? null))
      .catch((e) => setError(e.message))
  }, [ctx])

  useEffect(() => {
    refreshScores()
    ctx
      .loadSave<Save>()
      .then((s) => setHasSave(!!s && s.values.length === 81))
      .catch((e) => setError(e.message))
  }, [ctx, refreshScores])

  // Chrono
  useEffect(() => {
    if (phase !== 'playing') return
    const id = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [phase])

  // Sauvegarde automatique de la partie en cours (toutes les 5 s et à chaque changement de grille)
  useEffect(() => {
    if (phase !== 'playing' || values.length !== 81) return
    if (seconds % 5 !== 0 && seconds !== 0) return
    ctx.save({ difficulty, puzzle, solution, values, seconds, mistakes }).catch((e) => setError(e.message))
    // seconds suffit à déclencher ; les autres valeurs sont lues à jour dans la closure
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds, phase])

  function start(level: Difficulty) {
    const { puzzle: p, solution: s } = generatePuzzle(level)
    setDifficulty(level)
    setPuzzle(p)
    setSolution(s)
    setValues([...p])
    setSelected(null)
    setSeconds(0)
    setMistakes(0)
    setError(null)
    setPhase('playing')
  }

  async function resume() {
    try {
      const s = await ctx.loadSave<Save>()
      if (!s) return
      setDifficulty(s.difficulty)
      setPuzzle(s.puzzle)
      setSolution(s.solution)
      setValues(s.values)
      setSeconds(s.seconds)
      setMistakes(s.mistakes)
      setSelected(null)
      setError(null)
      setPhase('playing')
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function finish(finalSeconds: number, finalMistakes: number) {
    const final = computeScore(difficulty, finalSeconds, finalMistakes)
    setScore(final)
    setPhase('over')
    setHasSave(false)
    try {
      await ctx.clearSave()
      await ctx.submitScore(final, { difficulty, seconds: finalSeconds, mistakes: finalMistakes })
      refreshScores()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  function place(n: number) {
    if (selected === null || puzzle[selected] !== 0) return
    const next = [...values]
    next[selected] = n
    setValues(next)
    let m = mistakes
    if (n !== 0 && n !== solution[selected]) {
      m += 1
      setMistakes(m)
    }
    if (next.every((v, i) => v === solution[i])) void finish(seconds, m)
  }

  function onKeyDown(e: KeyboardEvent) {
    if (selected === null) return
    if (e.key >= '1' && e.key <= '9') place(Number(e.key))
    else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') place(0)
    else {
      const r = Math.floor(selected / 9)
      const c = selected % 9
      const move: Record<string, [number, number]> = {
        ArrowUp: [-1, 0],
        ArrowDown: [1, 0],
        ArrowLeft: [0, -1],
        ArrowRight: [0, 1],
      }
      const d = move[e.key]
      if (!d) return
      e.preventDefault()
      const nr = Math.min(8, Math.max(0, r + d[0]))
      const nc = Math.min(8, Math.max(0, c + d[1]))
      setSelected(nr * 9 + nc)
      cellRefs.current[nr * 9 + nc]?.focus()
    }
  }

  const conflicts = phase === 'playing' ? findConflicts(values) : new Set<number>()
  const selRow = selected === null ? -1 : Math.floor(selected / 9)
  const selCol = selected === null ? -1 : selected % 9

  return (
    <div className="sudoku">
      <div className="card sudoku-board">
        {phase === 'playing' ? (
          <>
            <p className="sudoku-stats">
              <span>Temps : {formatTime(seconds)}</span>
              <span>Erreurs : {mistakes}</span>
            </p>
            <div className="sudoku-grid" role="grid" aria-label="Grille de sudoku" onKeyDown={onKeyDown}>
              {values.map((v, i) => {
                const fixed = puzzle[i] !== 0
                const classes = ['sudoku-cell']
                if (fixed) classes.push('sudoku-fixed')
                if (i === selected) classes.push('sudoku-selected')
                else if (selected !== null && (Math.floor(i / 9) === selRow || i % 9 === selCol))
                  classes.push('sudoku-related')
                if (conflicts.has(i)) classes.push('sudoku-conflict')
                return (
                  <button
                    key={i}
                    ref={(el) => {
                      cellRefs.current[i] = el
                    }}
                    className={classes.join(' ')}
                    onClick={() => setSelected(i)}
                    aria-label={`Ligne ${Math.floor(i / 9) + 1}, colonne ${(i % 9) + 1}, ${v === 0 ? 'vide' : v}`}
                  >
                    {v === 0 ? '' : v}
                  </button>
                )
              })}
            </div>
            <div className="sudoku-pad">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                <button key={n} className="small" onClick={() => place(n)}>
                  {n}
                </button>
              ))}
              <button className="small" onClick={() => place(0)} aria-label="Effacer la case">
                Effacer
              </button>
            </div>
            <p className="muted">Sélectionne une case, puis tape un chiffre au clavier ou utilise le pavé.</p>
          </>
        ) : (
          <>
            {phase === 'over' && (
              <>
                <p className="result">
                  Bravo ! Score : <strong>{score}</strong>
                </p>
                <p className="muted">
                  Résolu en {formatTime(seconds)} avec {mistakes} erreur{mistakes > 1 ? 's' : ''}.
                </p>
                {ctx.isGuest && <p className="muted">Connecte-toi pour apparaître au classement.</p>}
              </>
            )}
            <p>Choisis une difficulté :</p>
            <div className="sudoku-levels">
              {(Object.keys(DIFFICULTIES) as Difficulty[]).map((level) => (
                <button key={level} onClick={() => start(level)}>
                  {DIFFICULTIES[level].label}
                </button>
              ))}
            </div>
            {hasSave && (
              <button className="link" onClick={resume}>
                Reprendre ma partie
              </button>
            )}
            {best !== null && <p className="muted">Ton meilleur score : {best}</p>}
          </>
        )}
        {error && <p className="error">{error}</p>}
      </div>
      <div className="card">
        <h2>Classement</h2>
        <Leaderboard entries={leaderboard} currentUserId={ctx.player?.id} />
      </div>
    </div>
  )
}
