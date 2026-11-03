import type { Board as BoardModel, Vehicle } from '../domain/board'
import { VehicleSprite } from './VehicleSprite'

const SIZE = 6
const RED_CAR = 'X'
const CAR_COLORS = 8
const TRUCK_COLORS = 4

const pct = (n: number) => `${(n * 100) / SIZE}%`

/** Couleur d'un véhicule : rouge pour X, sinon une couleur de la palette choisie d'après sa lettre. */
function colorOf(v: Vehicle) {
  if (v.id === RED_CAR) return 'var(--rush-hour-red)'
  const code = v.id.charCodeAt(0)
  return v.length === 3 ? `var(--rush-hour-truck-${code % TRUCK_COLORS})` : `var(--rush-hour-car-${code % CAR_COLORS})`
}

function labelOf(v: Vehicle) {
  if (v.id === RED_CAR) return 'Voiture rouge'
  const kind = v.length === 3 ? 'Camion' : 'Voiture'
  return `${kind} ${v.id}, ${v.orientation === 'H' ? 'horizontal' : 'vertical'}`
}

export function Board({ board }: { board: BoardModel }) {
  return (
    <div className="rush-hour-board-wrap">
      <div className="rush-hour-board" role="group" aria-label="Plateau Rush Hour">
        {board.vehicles.map((v) => (
          <div
            key={v.id}
            className="rush-hour-vehicle"
            role="img"
            aria-label={labelOf(v)}
            style={{
              left: pct(v.col),
              top: pct(v.row),
              width: pct(v.orientation === 'H' ? v.length : 1),
              height: pct(v.orientation === 'V' ? v.length : 1),
            }}
          >
            <VehicleSprite vehicle={v} color={colorOf(v)} />
          </div>
        ))}
      </div>
      <div className="rush-hour-exit" style={{ top: pct(2), height: pct(1) }} aria-hidden="true">
        ➜
      </div>
    </div>
  )
}
