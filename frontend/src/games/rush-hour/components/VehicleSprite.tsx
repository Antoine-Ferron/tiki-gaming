import type { Vehicle } from '../domain/board'

const CELL = 100

/**
 * Voiture (2 cases) ou camion (3 cases) vu de dessus, dessiné à l'horizontale, l'avant à droite.
 * Un véhicule vertical est le même dessin tourné d'un quart de tour (l'avant en bas).
 */
export function VehicleSprite({ vehicle, color }: { vehicle: Vehicle; color: string }) {
  const w = vehicle.length * CELL
  const vertical = vehicle.orientation === 'V'
  const viewBox = vertical ? `0 0 ${CELL} ${w}` : `0 0 ${w} ${CELL}`

  return (
    <svg viewBox={viewBox} className="rush-hour-sprite" aria-hidden="true">
      <g transform={vertical ? `translate(${CELL} 0) rotate(90)` : undefined} style={{ ['--body' as string]: color }}>
        {vehicle.length === 3 ? <Truck w={w} /> : <Car w={w} />}
      </g>
    </svg>
  )
}

function Wheels({ w }: { w: number }) {
  return (
    <g className="rush-hour-wheel">
      {[20, w - 46].map((x) => (
        <g key={x}>
          <rect x={x} y={4} width={26} height={16} rx={5} />
          <rect x={x} y={80} width={26} height={16} rx={5} />
        </g>
      ))}
    </g>
  )
}

function Car({ w }: { w: number }) {
  return (
    <>
      <Wheels w={w} />
      <rect className="rush-hour-body" x={6} y={14} width={w - 12} height={72} rx={24} />
      {/* toit */}
      <rect className="rush-hour-roof" x={w * 0.3} y={22} width={w * 0.42} height={56} rx={12} />
      {/* lunette arrière et pare-brise */}
      <rect className="rush-hour-glass" x={w * 0.24} y={26} width={w * 0.07} height={48} rx={6} />
      <rect className="rush-hour-glass" x={w * 0.68} y={24} width={w * 0.1} height={52} rx={8} />
      {/* phares */}
      <rect className="rush-hour-light" x={w - 16} y={20} width={8} height={14} rx={3} />
      <rect className="rush-hour-light" x={w - 16} y={66} width={8} height={14} rx={3} />
    </>
  )
}

function Truck({ w }: { w: number }) {
  const cab = 84
  const trailerEnd = w - cab - 2
  return (
    <>
      <Wheels w={w} />
      {/* remorque, attelée à la cabine */}
      <rect className="rush-hour-body" x={6} y={10} width={trailerEnd - 6} height={80} rx={10} />
      <rect className="rush-hour-roof" x={18} y={22} width={trailerEnd - 30} height={56} rx={6} />
      <rect className="rush-hour-roof" x={trailerEnd - 4} y={40} width={12} height={20} />
      {/* cabine */}
      <rect className="rush-hour-body" x={trailerEnd + 6} y={14} width={w - trailerEnd - 12} height={72} rx={18} />
      <rect className="rush-hour-glass" x={w - 40} y={24} width={16} height={52} rx={6} />
      <rect className="rush-hour-light" x={w - 14} y={22} width={8} height={12} rx={3} />
      <rect className="rush-hour-light" x={w - 14} y={66} width={8} height={12} rx={3} />
    </>
  )
}
