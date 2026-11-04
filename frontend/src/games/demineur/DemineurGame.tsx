import { useCallback, useEffect, useState } from 'react'
import { Leaderboard } from '@/components/Leaderboard'
import type { GameProps, LeaderboardEntry } from '../types'
import { calculateScore, createGrid, getOutcome, realRng, revealCell, toggleFlag, type Grid, type Rng } from './logic'
import './demineur.css'

// Niveaux classiques du démineur (voir REGLES.md).
type DifficultyKey = 'beginner' | 'intermediate' | 'expert'

const DIFFICULTIES: Record<
  DifficultyKey,
  { label: string; rows: number; cols: number; mines: number; cellSize: string }
> = {
  beginner: { label: 'Débutant (9×9, 10 mines)', rows: 9, cols: 9, mines: 10, cellSize: '2rem' },
  intermediate: { label: 'Intermédiaire (16×16, 40 mines)', rows: 16, cols: 16, mines: 40, cellSize: '1.5rem' },
  // Plus de colonnes qu'intermediate : case plus petite pour que la grille tienne sans scroll.
  expert: { label: 'Expert (30×16, 99 mines)', rows: 16, cols: 30, mines: 99, cellSize: '1rem' },
}

/**
 * Horloge injectable (même principe que `Rng`, voir sdv-civilisation/ports.ts) : un composant ne
 * doit pas appeler `Date.now()` directement (règle ESLint react-hooks/purity, React Compiler).
 */
interface Clock {
  now(): number
}
const realClock: Clock = { now: () => Date.now() }

type DemineurGameProps = GameProps & {
  /** Injectables pour les tests (Stub/PRNG seedé, horloge figée) ; le vrai aléatoire/la vraie horloge en production. */
  rng?: Rng
  clock?: Clock
}

export default function DemineurGame({ ctx, rng = realRng, clock = realClock }: DemineurGameProps) {
  const [difficulty, setDifficulty] = useState<DifficultyKey>('beginner')
  const [grid, setGrid] = useState<Grid>(() => {
    const { rows, cols, mines } = DIFFICULTIES.beginner
    return createGrid(rows, cols, mines, rng)
  })
  const [startedAt, setStartedAt] = useState(() => clock.now())
  const [score, setScore] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])

  const outcome = getOutcome(grid)
  const { cols, cellSize: idealCellSize } = DIFFICULTIES[difficulty]
  // Taille idéale si la place le permet, sinon rétrécit pour tenir dans la largeur de fenêtre
  // (marge de page + carte) : évite tout débordement, quelle que soit la largeur d'écran.
  const cellSize = `min(${idealCellSize}, calc((100vw - 5rem) / ${cols}))`

  const refreshLeaderboard = useCallback(() => {
    ctx
      .getLeaderboard(10)
      .then(setLeaderboard)
      .catch((e) => setError(e.message))
  }, [ctx])

  useEffect(() => {
    refreshLeaderboard()
  }, [refreshLeaderboard])

  function selectDifficulty(key: DifficultyKey) {
    const { rows, cols, mines } = DIFFICULTIES[key]
    setDifficulty(key)
    setGrid(createGrid(rows, cols, mines, rng))
    setStartedAt(clock.now())
    setScore(null)
    setError(null)
  }

  function newGame() {
    selectDifficulty(difficulty)
  }

  function finish(next: Grid) {
    const result = getOutcome(next)
    if (result !== 'won') return
    const elapsedSeconds = Math.max(0, Math.round((clock.now() - startedAt) / 1000))
    const points = calculateScore(elapsedSeconds, DIFFICULTIES[difficulty].mines)
    setScore(points)
    ctx
      .submitScore(points, { difficulty, elapsedSeconds })
      .then(refreshLeaderboard)
      .catch((e) => setError((e as Error).message))
  }

  function reveal(row: number, col: number) {
    if (outcome !== 'playing') return
    const next = grid.map((r) => [...r])
    revealCell(next, row, col)
    setGrid(next)
    finish(next)
  }

  function flag(event: React.MouseEvent, row: number, col: number) {
    event.preventDefault()
    if (outcome !== 'playing') return
    const next = grid.map((r) => [...r])
    toggleFlag(next, row, col)
    setGrid(next)
  }

  return (
    <div className="demineur">
      <div className="card demineur-board">
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          {(Object.keys(DIFFICULTIES) as DifficultyKey[]).map((key) => (
            <button key={key} className="small" disabled={key === difficulty} onClick={() => selectDifficulty(key)}>
              {DIFFICULTIES[key].label}
            </button>
          ))}
        </div>
        <div
          className="demineur-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${cols}, ${cellSize})`,
            gap: '2px',
            margin: '1rem 0',
            width: 'fit-content',
          }}
        >
          {grid.flatMap((row, rowIndex) =>
            row.map((cell, colIndex) => {
              const showMine = cell.mine && (cell.revealed || outcome === 'lost')
              const label = showMine
                ? '💣'
                : cell.flagged
                  ? '🚩'
                  : cell.revealed && cell.adjacentMines > 0
                    ? String(cell.adjacentMines)
                    : ''
              return (
                <button
                  key={`${rowIndex}-${colIndex}`}
                  aria-label={`Case ${rowIndex + 1}, ${colIndex + 1}`}
                  disabled={cell.revealed || outcome !== 'playing'}
                  onClick={() => reveal(rowIndex, colIndex)}
                  onContextMenu={(e) => flag(e, rowIndex, colIndex)}
                  style={{
                    width: cellSize,
                    height: cellSize,
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid #999',
                    borderRadius: 0,
                    background: showMine ? '#f8d7da' : cell.revealed ? '#eee' : undefined,
                    color: cell.revealed ? '#1a0d00' : undefined,
                  }}
                >
                  {label}
                </button>
              )
            }),
          )}
        </div>
        <p className="result">
          {outcome === 'lost' && 'Perdu'}
          {outcome === 'won' && 'Gagné'}
        </p>
        {outcome === 'won' && score !== null && <p className="muted">Score : {score}</p>}
        {outcome !== 'playing' && ctx.isGuest && <p className="muted">Connecte-toi pour apparaître au classement.</p>}
        <button className="big" onClick={newGame}>
          Nouvelle grille
        </button>
        {error && <p className="error">{error}</p>}
      </div>
      <div className="card">
        <h2>Classement</h2>
        <Leaderboard entries={leaderboard} currentUserId={ctx.player?.id} />
      </div>
    </div>
  )
}
