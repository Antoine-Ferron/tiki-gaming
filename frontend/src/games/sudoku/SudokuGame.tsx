import { useCallback, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Leaderboard } from '@/components/Leaderboard'
import type { GameProps, LeaderboardEntry } from '../types'
import { ApiError, apiGet, apiPost } from '@/lib/api'
import { DIFFICULTIES, formatTime, type Difficulty, type Grid } from './logic'
import { DEFAULT_MAX_MISTAKES, mistakesLabel, mistakesWarning } from './mistakes'
import './sudoku.css'

// La partie (grille, solution, erreurs, chrono) vit sur le serveur : on ne garde que son identifiant.
type Save = { gameId: string }

type GameState = {
  gameId: string
  difficulty: Difficulty
  puzzle: Grid
  values: Grid
  mistakes: number
  maxMistakes: number
  lost: boolean
  seconds: number
}
type PuzzleResponse = { gameId: string; difficulty: Difficulty; puzzle: Grid }
type MoveResult = { correct: boolean; mistakes: number; complete: boolean; lost: boolean }
type CheckResult = { solved: boolean; score: number }

type Phase = 'idle' | 'playing' | 'over' | 'lost'

export default function SudokuGame({ ctx }: GameProps) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [gameId, setGameId] = useState('')
  const [difficulty, setDifficulty] = useState<Difficulty>('easy')
  const [puzzle, setPuzzle] = useState<Grid>([])
  const [values, setValues] = useState<Grid>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [seconds, setSeconds] = useState(0)
  const [mistakes, setMistakes] = useState(0)
  const [maxMistakes, setMaxMistakes] = useState(DEFAULT_MAX_MISTAKES)
  const [score, setScore] = useState(0)
  const [hasSave, setHasSave] = useState(false)
  const [best, setBest] = useState<number | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const cellRefs = useRef<(HTMLButtonElement | null)[]>([])
  const busy = useRef(false)

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
      .then((s) => setHasSave(!!s?.gameId))
      .catch((e) => setError(e.message))
  }, [ctx, refreshScores])

  // Chrono d'affichage ; le temps du score est mesuré par le serveur.
  useEffect(() => {
    if (phase !== 'playing') return
    const id = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [phase])

  function open(state: GameState) {
    setGameId(state.gameId)
    setDifficulty(state.difficulty)
    setPuzzle(state.puzzle)
    setValues(state.values)
    setSeconds(state.seconds)
    setMistakes(state.mistakes)
    setMaxMistakes(state.maxMistakes)
    setSelected(null)
    setError(null)
    setNotice(null)
    setPhase(state.lost ? 'lost' : 'playing')
  }

  async function start(level: Difficulty) {
    try {
      const game = await apiGet<PuzzleResponse>(`/games/sudoku/puzzle?difficulty=${level}`)
      await ctx.save({ gameId: game.gameId } satisfies Save)
      setHasSave(true)
      open({ ...game, values: game.puzzle, mistakes: 0, maxMistakes: DEFAULT_MAX_MISTAKES, lost: false, seconds: 0 })
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function resume() {
    try {
      const s = await ctx.loadSave<Save>()
      if (!s?.gameId) return
      try {
        const state = await apiGet<GameState>(`/games/sudoku/${s.gameId}`)
        open(state)
        if (state.lost) await abandon()
      } catch (e) {
        if (!(e instanceof ApiError) || e.status !== 400) throw e
        // Partie inconnue du serveur (expirée ou serveur redémarré) : la sauvegarde ne sert plus.
        await ctx.clearSave()
        setHasSave(false)
        setError('Cette partie a expiré. Lance-en une nouvelle.')
      }
    } catch (e) {
      setError((e as Error).message)
    }
  }

  // Partie perdue : plus rien à reprendre, aucun score n'est envoyé.
  async function abandon() {
    setHasSave(false)
    await ctx.clearSave()
  }

  async function finish(finalMistakes: number) {
    try {
      const result = await apiPost<CheckResult>('/games/sudoku/check', { gameId })
      setScore(result.score)
      setPhase('over')
      setHasSave(false)
      await ctx.clearSave()
      await ctx.submitScore(result.score, { difficulty, seconds, mistakes: finalMistakes })
      refreshScores()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function place(n: number) {
    if (busy.current || selected === null || puzzle[selected] !== 0 || values[selected] !== 0) return
    busy.current = true
    try {
      const move = await apiPost<MoveResult>(`/games/sudoku/${gameId}/moves`, { cell: selected, value: n })
      setMistakes(move.mistakes)
      if (move.lost) {
        setPhase('lost')
        await abandon()
        return
      }
      if (!move.correct) {
        setNotice('Ce chiffre n’est pas le bon.')
        return
      }
      setNotice(null)
      const next = [...values]
      next[selected] = n
      setValues(next)
      if (move.complete) await finish(move.mistakes)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      busy.current = false
    }
  }

  function onKeyDown(e: KeyboardEvent) {
    if (selected === null) return
    if (e.key >= '1' && e.key <= '9') void place(Number(e.key))
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

  const selRow = selected === null ? -1 : Math.floor(selected / 9)
  const selCol = selected === null ? -1 : selected % 9

  return (
    <div className="sudoku">
      <div className="card sudoku-board">
        {phase === 'playing' ? (
          <>
            <p className="sudoku-stats">
              <span>Temps : {formatTime(seconds)}</span>
              <span>Erreurs : {mistakesLabel(mistakes, maxMistakes)}</span>
            </p>
            <div className="sudoku-grid" role="group" aria-label="Grille de sudoku" onKeyDown={onKeyDown}>
              {values.map((v, i) => {
                const fixed = puzzle[i] !== 0
                const classes = ['sudoku-cell']
                if (fixed) classes.push('sudoku-fixed')
                if (i === selected) classes.push('sudoku-selected')
                else if (selected !== null && (Math.floor(i / 9) === selRow || i % 9 === selCol))
                  classes.push('sudoku-related')
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
                <button key={n} className="small" onClick={() => void place(n)}>
                  {n}
                </button>
              ))}
            </div>
            {notice && (
              <p className="muted" role="status">
                {notice}
              </p>
            )}
            {mistakesWarning(mistakes, maxMistakes) && (
              <p className="error">{mistakesWarning(mistakes, maxMistakes)}</p>
            )}
            <p className="muted">Sélectionne une case, puis tape un chiffre au clavier ou utilise le pavé.</p>
          </>
        ) : (
          <>
            {phase === 'lost' && (
              <>
                <p className="result">Partie perdue : plus de {maxMistakes} erreurs.</p>
                <p className="muted">
                  Aucun score n’est enregistré. Lance une nouvelle partie pour retenter ta chance.
                </p>
              </>
            )}
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
                <button key={level} onClick={() => void start(level)}>
                  {DIFFICULTIES[level].label}
                </button>
              ))}
            </div>
            {hasSave && (
              <button className="link" onClick={() => void resume()}>
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
