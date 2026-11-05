import { useRef, useState, type KeyboardEvent, type FormEvent } from 'react'
import { Field } from '@/components/Field'
import { validate } from '@/lib/validation'
import type { Piece, Player, Position } from './types'
import { namesSchema } from './names'
import { useDameMatch } from './useDameMatch'
import {
  completedMove,
  coordinateLabel,
  nextDestinations,
  pieceCounts,
  positionKey,
  previewPieces,
  samePosition,
  selectableOrigins,
} from './ui'
import './dame.css'

const COLUMNS = 'ABCDEFGHIJ'.split('')
const SQUARES: Position[] = Array.from({ length: 100 }, (_, index) => ({
  row: Math.floor(index / 10),
  column: index % 10,
}))
const PLAYER_NAMES: Record<Player, string> = { WHITE: 'Blancs', BLACK: 'Noirs' }

function pieceLabel(piece: Piece): string {
  return `${piece.king ? 'dame' : 'pion'} ${piece.owner === 'WHITE' ? 'blanc' : 'noir'}`
}

export default function DameGame() {
  const controller = useDameMatch()
  const { view, selection, error } = controller
  const busy = controller.pending !== null
  const [focusedIndex, setFocusedIndex] = useState(61)
  const squareButtons = useRef<Array<HTMLButtonElement | null>>([])

  function submitNames(event: FormEvent) {
    event.preventDefault()
    const result = validate(namesSchema, controller.names)
    if ('errors' in result) {
      controller.setFields(result.errors)
      return
    }
    void controller.start(result.data)
  }

  function selectSquare(position: Position) {
    if (busy || controller.needsRefresh || !view || view.status !== 'IN_PROGRESS') return
    const destinations = nextDestinations(view.legalMoves, selection)
    if (selection && destinations.some((destination) => samePosition(destination, position))) {
      const nextSelection = { ...selection, landings: [...selection.landings, position] }
      const move = completedMove(view.legalMoves, nextSelection)
      if (move) controller.play(move)
      else controller.setSelection(nextSelection)
      return
    }
    if (selection && selection.landings.length > 0) return
    if (selection && samePosition(selection.from, position)) controller.setSelection(null)
    else if (view.legalMoves.some((move) => samePosition(move.from, position)))
      controller.setSelection({ from: position, landings: [] })
    else controller.setSelection(null)
  }

  function moveFocus(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const row = Math.floor(index / 10)
    const column = index % 10
    let nextIndex = index
    switch (event.key) {
      case 'ArrowLeft':
        if (column > 0) nextIndex--
        break
      case 'ArrowRight':
        if (column < 9) nextIndex++
        break
      case 'ArrowUp':
        if (row > 0) nextIndex -= 10
        break
      case 'ArrowDown':
        if (row < 9) nextIndex += 10
        break
      case 'Home':
        nextIndex = row * 10
        break
      case 'End':
        nextIndex = row * 10 + 9
        break
      default:
        return
    }
    event.preventDefault()
    setFocusedIndex(nextIndex)
    squareButtons.current[nextIndex]?.focus()
  }

  if (controller.pending === 'resume' && !view) {
    return (
      <p className="muted" role="status">
        Reprise de la partie…
      </p>
    )
  }

  if (controller.setup || !view) {
    return (
      <section className="dame card" aria-labelledby="dame-setup-title">
        <h2 id="dame-setup-title">Les joueurs</h2>
        <p>Une partie de dames internationales à deux sur le même écran.</p>
        <form className="form" noValidate onSubmit={submitNames} aria-busy={busy}>
          <Field
            label="Joueur blanc"
            aria-label="Joueur blanc"
            name="whiteName"
            autoComplete="off"
            value={controller.names.whiteName}
            error={controller.fields.whiteName}
            hint="De 1 à 50 caractères. Les blancs commencent."
            disabled={busy}
            onChange={(e) => controller.setNames({ ...controller.names, whiteName: e.target.value })}
          />
          <Field
            label="Joueur noir"
            aria-label="Joueur noir"
            name="blackName"
            autoComplete="off"
            value={controller.names.blackName}
            error={controller.fields.blackName}
            hint="De 1 à 50 caractères."
            disabled={busy}
            onChange={(e) => controller.setNames({ ...controller.names, blackName: e.target.value })}
          />
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {controller.needsRefresh && (
            <button type="button" className="secondary" disabled={busy} onClick={controller.refresh}>
              Actualiser la partie
            </button>
          )}
          <button type="submit" disabled={busy}>
            {busy ? 'Préparation…' : 'Commencer la partie'}
          </button>
          {view && (
            <button type="button" className="link" disabled={busy} onClick={() => controller.setSetup(false)}>
              Revenir à la partie
            </button>
          )}
        </form>
        <p className="muted">
          Les noms sont enregistrés au démarrage et le résultat à la fin. Le plateau dépend de ta session ; son
          expiration empêche de reprendre la partie.
        </p>
      </section>
    )
  }

  const origins = selectableOrigins(view.legalMoves)
  const destinations = nextDestinations(view.legalMoves, selection)
  const displayedPieces = previewPieces(view.board.pieces, selection)
  const piecesByPosition = new Map(displayedPieces.map((piece) => [positionKey(piece), piece]))
  const selectedPosition = selection?.landings.at(-1) ?? selection?.from
  const finished = view.status !== 'IN_PROGRESS'
  const winnerName = view.status === 'WHITE_WON' ? view.whiteName : view.blackName
  const title = finished
    ? `${winnerName} remporte la partie !`
    : `${view.currentPlayer === 'WHITE' ? view.whiteName : view.blackName} · ${PLAYER_NAMES[view.currentPlayer]} à jouer`
  const instruction = busy
    ? 'Coup en cours…'
    : controller.needsRefresh
      ? 'Actualise la partie avant de continuer.'
      : finished
        ? 'Lance une nouvelle partie pour rejouer.'
        : selection?.landings.length
          ? 'Poursuis la prise en choisissant une arrivée marquée.'
          : selection
            ? 'Choisis une arrivée marquée d’un point.'
            : 'Choisis une pièce entourée pour commencer ton coup.'
  return (
    <div className="dame">
      <div className="dame-layout">
        <section className="card dame-arena" aria-labelledby="dame-title">
          <div className="dame-arena-heading">
            <div>
              <p className="dame-eyebrow">Duel sur le même écran</p>
              <h2 id="dame-title">Le damier</h2>
            </div>
            <span className="dame-format">10 × 10</span>
          </div>

          <div
            className={`dame-turn${finished ? ' dame-turn-finished' : ''}`}
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            <span
              className={`dame-turn-marker dame-turn-marker-${view?.currentPlayer.toLowerCase() ?? 'white'}`}
              aria-hidden="true"
            />
            <div>
              <strong>{title}</strong>
              <p>{instruction}</p>
            </div>
          </div>

          <div className="dame-board-frame" aria-busy={busy}>
            <div className="dame-column-labels" aria-hidden="true">
              {COLUMNS.map((column) => (
                <span key={column}>{column}</span>
              ))}
            </div>
            <div className="dame-row-labels" aria-hidden="true">
              {Array.from({ length: 10 }, (_, row) => (
                <span key={row}>{10 - row}</span>
              ))}
            </div>
            <div
              className="dame-board"
              role="group"
              aria-label="Damier de dix lignes et dix colonnes"
              aria-describedby="dame-keyboard-help"
            >
              {SQUARES.map((position, index) => {
                const piece = piecesByPosition.get(positionKey(position))
                const next = destinations.some((destination) => samePosition(destination, position))
                const selectable = origins.some((origin) => samePosition(origin, position))
                const selected = Boolean(view && selectedPosition && samePosition(selectedPosition, position))
                const actionable = Boolean(
                  view && !finished && !busy && (next || (!selection?.landings.length && selectable)),
                )
                const label = [
                  coordinateLabel(position),
                  piece ? pieceLabel(piece) : 'case vide',
                  next ? 'arrivée possible' : selectable && !selection?.landings.length ? 'pièce sélectionnable' : '',
                  selected ? 'sélection' : '',
                ]
                  .filter(Boolean)
                  .join(', ')
                return (
                  <button
                    key={positionKey(position)}
                    ref={(node) => {
                      squareButtons.current[index] = node
                    }}
                    type="button"
                    className={[
                      'dame-square',
                      (position.row + position.column) % 2 === 1 ? 'dame-square-dark' : 'dame-square-light',
                      selected ? 'dame-square-selected' : '',
                      next ? 'dame-square-next' : '',
                      selectable && !selection?.landings.length ? 'dame-square-selectable' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    aria-label={label}
                    aria-pressed={selected}
                    aria-disabled={!actionable}
                    disabled={busy || controller.needsRefresh}
                    tabIndex={focusedIndex === index ? 0 : -1}
                    onFocus={() => setFocusedIndex(index)}
                    onKeyDown={(event) => moveFocus(event, index)}
                    onClick={() => selectSquare(position)}
                  >
                    {piece && (
                      <span
                        className={`dame-piece dame-piece-${piece.owner.toLowerCase()}${piece.king ? ' dame-piece-king' : ''}`}
                        aria-hidden="true"
                      >
                        {piece.king ? 'D' : <span className="dame-piece-center" />}
                      </span>
                    )}
                    {next && <span className="dame-destination" aria-hidden="true" />}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="dame-board-footer">
            <p id="dame-keyboard-help" className="muted">
              Clavier : flèches pour naviguer, Entrée ou Espace pour choisir.
            </p>
            {selection && !busy && (
              <button type="button" className="link" onClick={() => controller.setSelection(null)}>
                {selection.landings.length ? 'Recommencer le coup' : 'Annuler la sélection'}
              </button>
            )}
          </div>
          {error && (
            <div className="dame-error" role="alert">
              <p className="error">{error}</p>
              <button
                type="button"
                className="small"
                disabled={busy}
                onClick={() => {
                  controller.refresh()
                }}
              >
                Actualiser la partie
              </button>
            </div>
          )}
        </section>

        <aside className="dame-sidebar" aria-label="Informations de la partie">
          <section className="card dame-summary">
            <h2>La partie</h2>
            <p className="muted dame-summary-intro">Deux camps. Un damier. À chacun son tour.</p>
            {(['WHITE', 'BLACK'] as const).map((player) => {
              const counts = pieceCounts(view?.board.pieces ?? [], player)
              const active = view?.currentPlayer === player && !finished
              return (
                <div key={player} className={`dame-player${active ? ' dame-player-active' : ''}`}>
                  <span className={`dame-player-token dame-piece-${player.toLowerCase()}`} aria-hidden="true">
                    {player === 'WHITE' ? 'B' : 'N'}
                  </span>
                  <div className="dame-player-details">
                    <strong>
                      {view ? (player === 'WHITE' ? view.whiteName : view.blackName) : PLAYER_NAMES[player]}
                    </strong>
                    <span className="muted">
                      {view ? `${counts.total} pièces · ${counts.kings} dames` : 'En préparation'}
                    </span>
                  </div>
                  {active && <span className="dame-player-turn">Au trait</span>}
                </div>
              )
            })}
            <button
              type="button"
              className="dame-new-game"
              disabled={busy}
              onClick={() => {
                controller.setSetup(true)
              }}
            >
              {controller.pending === 'start' ? 'Préparation…' : finished ? 'Rejouer' : 'Nouvelle partie'}
            </button>
            <p className="muted dame-session-note">
              Partage cet écran avec ton adversaire. Les noms sont des noms d’affichage, sans compte requis.
            </p>
          </section>
          <section className="card dame-guide">
            <h2>À toi de jouer</h2>
            <ol>
              <li>Choisis une pièce entourée.</li>
              <li>Choisis une arrivée marquée d’un point.</li>
              <li>Si la prise continue, choisis chaque arrivée jusqu’au bout.</li>
            </ol>
            <p className="dame-king-key">
              <span className="dame-king-symbol" aria-hidden="true">
                D
              </span>{' '}
              Une dame se reconnaît à la lettre D.
            </p>
            <p className="muted dame-local-note">
              Le plateau reste dans ta session. Le rechargement reprend la rencontre si la session est encore
              disponible.
            </p>
          </section>
        </aside>
      </div>
    </div>
  )
}
