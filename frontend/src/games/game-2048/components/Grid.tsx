import type { Grid as GridData } from '../domain/board'

/** Grille du jeu ; chaque tuile est annoncée par son nombre, une case vide par « vide » (C2). */
export function Grid({ grid }: { grid: GridData }) {
  return (
    <div className="game-2048-grid" role="grid" aria-label="Grille">
      {grid.map((row, r) => (
        <div className="game-2048-row" role="row" key={r}>
          {row.map((value, c) => (
            <div
              className="game-2048-cell"
              role="gridcell"
              aria-label={value === 0 ? 'vide' : String(value)}
              data-value={value === 0 ? undefined : Math.min(value, 4096)}
              key={c}
            >
              {value === 0 ? '' : value}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
