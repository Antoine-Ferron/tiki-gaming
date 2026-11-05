import { useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import { type Board as BoardModel, EXIT_ROW, RED_CAR, SIZE, type Vehicle } from '../domain/board'
import { moveRange } from '../domain/moves'
import { dragOffset, dropDelta } from './drag'
import { vehicleLabel } from './vehicleLabel'
import { VehicleSprite } from './VehicleSprite'

const CAR_COLORS = 8
const TRUCK_COLORS = 4

const pct = (n: number) => `${(n * 100) / SIZE}%`

/** Couleur d'un véhicule : rouge pour X, sinon une couleur de la palette choisie d'après sa lettre. */
function colorOf(v: Vehicle) {
  if (v.id === RED_CAR) return 'var(--rush-hour-red)'
  const code = v.id.charCodeAt(0)
  return v.length === 3 ? `var(--rush-hour-truck-${code % TRUCK_COLORS})` : `var(--rush-hour-car-${code % CAR_COLORS})`
}

/** Flèche → déplacement d'une case, seulement dans le sens du véhicule. */
function stepOf(v: Vehicle, key: string): number | null {
  const steps: Record<string, number> =
    v.orientation === 'H' ? { ArrowLeft: -1, ArrowRight: 1 } : { ArrowUp: -1, ArrowDown: 1 }
  return steps[key] ?? null
}

type Drag = { id: string; start: number; min: number; max: number; offset: number }

type BoardProps = {
  board: BoardModel
  /** Plus aucun déplacement (partie gagnée). */
  locked: boolean
  /** Véhicule à mettre en avant (indice). */
  highlight?: string
  onMove: (id: string, delta: number) => void
}

export function Board({ board, locked, highlight, onMove }: BoardProps) {
  const boardRef = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<Drag | null>(null)

  const axis = (v: Vehicle, e: { clientX: number; clientY: number }) => (v.orientation === 'H' ? e.clientX : e.clientY)

  function onPointerDown(v: Vehicle, e: PointerEvent) {
    if (locked) return
    e.currentTarget.setPointerCapture(e.pointerId)
    setDrag({ id: v.id, start: axis(v, e), ...moveRange(board, v.id), offset: 0 })
  }

  function onPointerMove(v: Vehicle, e: PointerEvent) {
    if (drag?.id !== v.id || !boardRef.current) return
    const offset = dragOffset(axis(v, e) - drag.start, boardRef.current.clientWidth / SIZE, drag)
    setDrag({ ...drag, offset })
  }

  function onPointerUp(v: Vehicle) {
    if (drag?.id !== v.id) return
    const delta = dropDelta(drag.offset)
    setDrag(null)
    if (delta !== 0) onMove(v.id, delta)
  }

  function onKeyDown(v: Vehicle, e: KeyboardEvent) {
    const step = stepOf(v, e.key)
    if (step === null || locked) return
    e.preventDefault()
    const { min, max } = moveRange(board, v.id)
    if (step >= min && step <= max) onMove(v.id, step)
  }

  return (
    <div className="rush-hour-board-wrap">
      <div className="rush-hour-board" ref={boardRef} role="group" aria-label="Plateau Rush Hour">
        {board.vehicles.map((v) => {
          const horizontal = v.orientation === 'H'
          const offset = drag?.id === v.id ? drag.offset : 0
          return (
            <button
              key={v.id}
              type="button"
              className={`rush-hour-vehicle${drag?.id === v.id ? ' rush-hour-dragging' : ''}${highlight === v.id ? ' rush-hour-hinted' : ''}`}
              aria-label={vehicleLabel(v)}
              disabled={locked}
              style={{
                left: pct(v.col + (horizontal ? offset : 0)),
                top: pct(v.row + (horizontal ? 0 : offset)),
                width: pct(horizontal ? v.length : 1),
                height: pct(horizontal ? 1 : v.length),
              }}
              onPointerDown={(e) => onPointerDown(v, e)}
              onPointerMove={(e) => onPointerMove(v, e)}
              onPointerUp={() => onPointerUp(v)}
              onPointerCancel={() => setDrag(null)}
              onKeyDown={(e) => onKeyDown(v, e)}
            >
              <VehicleSprite vehicle={v} color={colorOf(v)} />
            </button>
          )
        })}
      </div>
      <div className="rush-hour-exit" style={{ top: pct(EXIT_ROW), height: pct(1) }} aria-hidden="true">
        ➜
      </div>
    </div>
  )
}
