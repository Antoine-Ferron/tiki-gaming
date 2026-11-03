import { useState } from 'react'
import type { GameProps } from '../types'
import { createGrid, type Grid } from './logic'

// Niveaux classiques du démineur (voir REGLES.md).
type DifficultyKey = 'beginner' | 'intermediate' | 'expert'

const DIFFICULTIES: Record<DifficultyKey, { label: string; rows: number; cols: number; mines: number }> = {
  beginner: { label: 'Débutant (9×9, 10 mines)', rows: 9, cols: 9, mines: 10 },
  intermediate: { label: 'Intermédiaire (16×16, 40 mines)', rows: 16, cols: 16, mines: 40 },
  expert: { label: 'Expert (30×16, 99 mines)', rows: 16, cols: 30, mines: 99 },
}

export default function DemineurGame({ ctx }: GameProps) {
  const [difficulty, setDifficulty] = useState<DifficultyKey>('beginner')
  const [grid, setGrid] = useState<Grid>(() => {
    const { rows, cols, mines } = DIFFICULTIES.beginner
    return createGrid(rows, cols, mines)
  })

  function selectDifficulty(key: DifficultyKey) {
    const { rows, cols, mines } = DIFFICULTIES[key]
    setDifficulty(key)
    setGrid(createGrid(rows, cols, mines))
  }

  function newGame() {
    selectDifficulty(difficulty)
  }

  const cols = DIFFICULTIES[difficulty].cols

  return (
    <div className="demineur">
      <div className="card">
        <p className="muted">
          Aperçu de la grille générée. Pas encore jouable : la révélation des cases, les drapeaux et le score ne sont
          pas encore implémentés (voir REGLES.md).
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          {(Object.keys(DIFFICULTIES) as DifficultyKey[]).map((key) => (
            <button key={key} className="small" disabled={key === difficulty} onClick={() => selectDifficulty(key)}>
              {DIFFICULTIES[key].label}
            </button>
          ))}
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${cols}, 2rem)`,
            gap: '2px',
            margin: '1rem 0',
          }}
        >
          {grid.flatMap((row, rowIndex) =>
            row.map((cell, colIndex) => (
              <div
                key={`${rowIndex}-${colIndex}`}
                style={{
                  width: '2rem',
                  height: '2rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid #999',
                  background: cell.mine ? '#f8d7da' : '#eee',
                }}
              >
                {cell.mine ? '💣' : ''}
              </div>
            )),
          )}
        </div>
        <button className="big" onClick={newGame}>
          Nouvelle grille
        </button>
        {ctx.isGuest && <p className="muted">Mode invité.</p>}
      </div>
    </div>
  )
}
