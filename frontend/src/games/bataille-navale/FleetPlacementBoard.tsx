import { useState } from 'react'
import {
  FLEET,
  GRID_SIZE,
  canPlaceShip,
  coordKey,
  placeFleetRandomly,
  shipCoords,
  type Coord,
  type Orientation,
  type PlacedShip,
} from './logic'

type FleetPlacementBoardProps = {
  /** Appelé une fois que le joueur valide sa flotte complète (manuelle ou tirée au hasard). */
  onComplete: (fleet: PlacedShip[]) => void
}

/**
 * Placement de la flotte, manuel ou aléatoire. Entièrement jouable au clavier : chaque case et chaque bouton
 * sont de simples `<button>`, atteignables par tabulation et activables par Entrée/Espace (comportement natif),
 * donc sans navigation par flèches à réinventer.
 */
export default function FleetPlacementBoard({ onComplete }: FleetPlacementBoardProps) {
  const [placed, setPlaced] = useState<PlacedShip[]>([])
  const [orientation, setOrientation] = useState<Orientation>('horizontal')
  const [hover, setHover] = useState<Coord | null>(null)

  const nextShip = FLEET[placed.length]
  const done = placed.length === FLEET.length
  const occupied = new Set(placed.flatMap((p) => p.coords.map(coordKey)))

  const preview = !done && hover ? shipCoords(hover, nextShip.size, orientation) : []
  const previewValid = preview.length > 0 && canPlaceShip(placed, preview)
  const previewKeys = new Set(preview.map(coordKey))

  function place(start: Coord) {
    if (done) return
    const coords = shipCoords(start, nextShip.size, orientation)
    if (!canPlaceShip(placed, coords)) return
    setPlaced((prev) => [...prev, { ship: nextShip, coords }])
  }

  function placeRandomly() {
    setPlaced(placeFleetRandomly())
  }

  function reset() {
    setPlaced([])
  }

  return (
    <div className="bn-placement">
      <div className="bn-placement-board">
        <div
          className="bn-grid"
          role="grid"
          aria-label="Place ta flotte"
          onMouseLeave={() => setHover(null)}
        >
          {Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, i) => {
            const cell: Coord = { row: Math.floor(i / GRID_SIZE), col: i % GRID_SIZE }
            const key = coordKey(cell)
            const hasShip = occupied.has(key)
            const inPreview = previewKeys.has(key)
            const classes = ['bn-cell', 'bn-cell-placement']
            if (hasShip) classes.push('ship')
            else if (inPreview) classes.push(previewValid ? 'preview-valid' : 'preview-invalid')
            return (
              <button
                key={key}
                type="button"
                className={classes.join(' ')}
                disabled={done}
                onMouseEnter={() => setHover(cell)}
                onFocus={() => setHover(cell)}
                onClick={() => place(cell)}
                aria-label={`Case ${cell.row + 1},${cell.col + 1}${hasShip ? ', occupée' : ''}`}
              />
            )
          })}
        </div>
      </div>

      <div className="bn-placement-panel">
        <ul className="bn-fleet-list">
          {FLEET.map((ship, i) => (
            <li key={ship.name} className={i < placed.length ? 'placed' : undefined}>
              {ship.name} ({ship.size})
            </li>
          ))}
        </ul>

        {!done && (
          <p className="muted">
            Prochain navire : {nextShip.name} ({nextShip.size} cases), {orientation === 'horizontal' ? 'horizontal' : 'vertical'}.
          </p>
        )}

        <div className="bn-placement-actions">
          <button type="button" className="small" onClick={() => setOrientation((o) => (o === 'horizontal' ? 'vertical' : 'horizontal'))}>
            Tourner ({orientation === 'horizontal' ? 'horizontal' : 'vertical'})
          </button>
          <button type="button" className="small" onClick={placeRandomly}>
            Placer au hasard
          </button>
          <button type="button" className="small" onClick={reset} disabled={placed.length === 0}>
            Recommencer
          </button>
        </div>

        <button type="button" className="big" disabled={!done} onClick={() => onComplete(placed)}>
          Prêt
        </button>
      </div>
    </div>
  )
}
