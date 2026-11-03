import { useState, type CSSProperties, type KeyboardEvent } from 'react'
import { cellName, entryAt, entryCoord, entryName, nextPiece, trace, type Grid, type Piece } from './engine'
import type { ProbeResult } from './expedition'
import { PIECE_NAMES, outcomeText } from './labels'

type BoardProps = {
  size: number
  /** Carte dessinée : celle du joueur pendant l'étage, la vraie une fois l'étage terminé. */
  grid: Grid
  results: ProbeResult[]
  /** Entrée connue → indice du tir dans `results`. */
  known: ReadonlyMap<number, number>
  /** Entrée dont le trajet est tracé sur `grid`. */
  beamEntry: number | null
  withObsidian: boolean
  /** Cases où la carte du joueur différait de la vraie (fin d'expédition). */
  mistakes?: ReadonlySet<number>
  describedBy?: string
  onEntry(entry: number): void
  onHover(entry: number | null): void
  /** Absent : galerie en lecture seule, seules les entrées restent utilisables. */
  onPlace?(cell: number, piece: Piece): void
}

/**
 * Le plateau est une grille (taille + 2)² : la galerie entourée de son anneau d'entrées.
 * Une « position » numérote ces cases ligne par ligne, coins compris.
 */
type Spot = { kind: 'corner' } | { kind: 'entry'; entry: number } | { kind: 'cell'; cell: number }

function spotAt(pos: number, size: number): Spot {
  const row = Math.floor(pos / (size + 2)) - 1
  const col = (pos % (size + 2)) - 1
  const outRow = row < 0 || row >= size
  const outCol = col < 0 || col >= size
  if (outRow && outCol) return { kind: 'corner' }
  if (outRow || outCol) return { kind: 'entry', entry: entryAt(row, col, size) }
  return { kind: 'cell', cell: row * size + col }
}

const MOVES: Record<string, [number, number]> = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
}

/** Touches de pose : chiffres (repérés par leur position, quelle que soit la disposition du clavier) ou symboles. */
function pieceForKey({ key, code }: KeyboardEvent, withObsidian: boolean): Piece | null {
  if (key === '/' || code === 'Digit1' || code === 'Numpad1') return '/'
  if (key === '\\' || code === 'Digit2' || code === 'Numpad2') return '\\'
  if (withObsidian && (key === 'o' || key === 'O' || code === 'Digit3' || code === 'Numpad3')) return '#'
  if (key === 'Backspace' || key === 'Delete' || code === 'Digit0' || code === 'Numpad0') return '.'
  return null
}

function PieceIcon({ piece }: { piece: Piece }) {
  if (piece === '.') return null
  return (
    <svg className="prismine-piece" viewBox="0 0 10 10" aria-hidden="true">
      {piece === '#' ? (
        <polygon className="prismine-obsidian" points="5,1.5 8.5,5 5,8.5 1.5,5" />
      ) : (
        <line className="prismine-crystal" x1={2} y1={piece === '/' ? 8 : 2} x2={8} y2={piece === '/' ? 2 : 8} />
      )}
    </svg>
  )
}

export function Board({
  size,
  grid,
  results,
  known,
  beamEntry,
  withObsidian,
  mistakes,
  describedBy,
  onEntry,
  onHover,
  onPlace,
}: BoardProps) {
  const n = size + 2
  // Une seule position est atteignable à la tabulation ; les flèches déplacent le focus (roving tabindex).
  const [focused, setFocused] = useState(1)
  const focusable = (spot: Spot) => spot.kind === 'entry' || (spot.kind === 'cell' && onPlace !== undefined)
  const tabStop = focused < n * n && focusable(spotAt(focused, size)) ? focused : 1

  const beam = beamEntry === null ? null : trace(grid, size, beamEntry)
  const beamProbe = beamEntry === null ? undefined : known.get(beamEntry)
  // Centre d'une case (row, col de la galerie, -1 et `size` pour le bord) dans le repère du plateau.
  const beamPoints = beam?.path.map(([row, col]) => [col + 1.5, row + 1.5]) ?? []
  const beamPolyline = beamPoints.map(([x, y]) => `${x},${y}`).join(' ')
  const beamEnd = beamPoints[beamPoints.length - 1]
  const lines = Array.from({ length: size + 1 }, (_, i) => i + 1)

  function nextFocusable(from: number, [dRow, dCol]: [number, number]) {
    let row = Math.floor(from / n) + dRow
    let col = (from % n) + dCol
    while (row >= 0 && col >= 0 && row < n && col < n) {
      if (focusable(spotAt(row * n + col, size))) return row * n + col
      row += dRow
      col += dCol
    }
    return null
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const pos = Number((event.target as HTMLElement).dataset.pos)
    if (!Number.isInteger(pos)) return
    const move = MOVES[event.key]
    if (move) {
      event.preventDefault()
      const target = nextFocusable(pos, move)
      if (target !== null) event.currentTarget.querySelector<HTMLElement>(`[data-pos="${target}"]`)?.focus()
      return
    }
    const spot = spotAt(pos, size)
    const piece = pieceForKey(event, withObsidian)
    if (spot.kind === 'cell' && onPlace && piece) {
      event.preventDefault()
      onPlace(spot.cell, piece)
    }
  }

  function renderSpot(pos: number) {
    const spot = spotAt(pos, size)
    if (spot.kind === 'corner') return <span key={pos} aria-hidden="true" />

    if (spot.kind === 'entry') {
      const { entry } = spot
      const index = known.get(entry)
      const probe = index === undefined ? null : results[index]
      const active = beamEntry !== null && (entry === beamEntry || (index !== undefined && index === beamProbe))
      const label =
        index === undefined || !probe
          ? `${entryName(entry, size)} : envoyer un faisceau`
          : `${entryName(entry, size)} : tir ${index + 1} (${entryName(probe.entry, size)}, ${outcomeText(probe, size)})`
      return (
        <button
          key={pos}
          type="button"
          data-pos={pos}
          tabIndex={pos === tabStop ? 0 : -1}
          className={`prismine-entry${active ? ' prismine-entry-active' : ''}`}
          aria-label={label}
          title={label}
          onClick={() => onEntry(entry)}
          onFocus={() => {
            setFocused(pos)
            onHover(entry)
          }}
          onBlur={() => onHover(null)}
          onMouseEnter={() => onHover(entry)}
        >
          {index === undefined || !probe ? (
            entryCoord(entry, size)
          ) : (
            <span className={`prismine-badge${probe.revealed ? ' prismine-badge-revealed' : ''}`}>{index + 1}</span>
          )}
        </button>
      )
    }

    const { cell } = spot
    const piece = grid[cell] as Piece
    const className = `prismine-cell${mistakes?.has(cell) ? ' prismine-cell-wrong' : ''}`
    // En lecture seule, la solution est décrite en texte à côté du plateau pour les lecteurs d'écran.
    if (!onPlace) {
      return (
        <span key={pos} className={className} aria-hidden="true">
          <PieceIcon piece={piece} />
        </span>
      )
    }
    return (
      <button
        key={pos}
        type="button"
        data-pos={pos}
        tabIndex={pos === tabStop ? 0 : -1}
        className={className}
        aria-label={`${cellName(cell, size)} : ${PIECE_NAMES[piece]}`}
        onClick={() => onPlace(cell, nextPiece(piece, withObsidian))}
        onContextMenu={(event) => {
          event.preventDefault()
          onPlace(cell, nextPiece(piece, withObsidian, true))
        }}
        onFocus={() => {
          setFocused(pos)
          onHover(null)
        }}
        onMouseEnter={() => onHover(null)}
      >
        <PieceIcon piece={piece} />
      </button>
    )
  }

  return (
    <div
      className="prismine-board"
      style={{ '--prismine-cols': n } as CSSProperties}
      role="group"
      aria-label={`Galerie de ${size} cases sur ${size}`}
      aria-describedby={describedBy}
      onKeyDown={handleKeyDown}
      onMouseLeave={() => onHover(null)}
    >
      {Array.from({ length: n * n }, (_, pos) => renderSpot(pos))}
      <svg className="prismine-overlay" viewBox={`0 0 ${n} ${n}`} aria-hidden="true">
        <g className="prismine-gridlines">
          {lines.map((k) => (
            <line key={`v${k}`} x1={k} y1={1} x2={k} y2={size + 1} />
          ))}
          {lines.map((k) => (
            <line key={`h${k}`} x1={1} y1={k} x2={size + 1} y2={k} />
          ))}
        </g>
        {beam && (
          <g key={beamEntry} className="prismine-beam">
            <polyline className="prismine-beam-glow" points={beamPolyline} />
            <polyline className="prismine-beam-core" points={beamPolyline} />
            {beam.exit === null && <circle cx={beamEnd[0]} cy={beamEnd[1]} r={0.18} />}
          </g>
        )}
      </svg>
    </div>
  )
}
