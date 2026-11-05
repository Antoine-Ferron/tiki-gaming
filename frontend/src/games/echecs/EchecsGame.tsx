import { useState } from 'react'
import { ApiError } from '@/lib/api'
import type { GameProps } from '../types'
import { destinations, type GameStatus, play, type Promotion } from './api'
import { FILES, isWhite, piecesFromFen, RANKS, squareLabel, START_FEN, SYMBOLS } from './board'
import './echecs.css'

/** Une position de la partie, telle que renvoyée par le serveur. */
type Snapshot = {
  fen: string
  status: GameStatus
  lastMove: [string, string] | null
  /** Coup qui a mené à cette position, en notation « e2-e4 » (`null` pour la position de départ). */
  move: string | null
  /** Fin décidée par les joueurs : abandon (F6) ou nulle par accord (F7). */
  ended: string | null
}

const START: Snapshot = { fen: START_FEN, status: 'ONGOING', lastMove: null, move: null, ended: null }

const PROMOTIONS: { letter: Promotion; name: string; short: string }[] = [
  { letter: 'q', name: 'Dame', short: 'D' },
  { letter: 'r', name: 'Tour', short: 'T' },
  { letter: 'b', name: 'Fou', short: 'F' },
  { letter: 'n', name: 'Cavalier', short: 'C' },
]

const DRAWS: Partial<Record<GameStatus, string>> = {
  STALEMATE: 'Pat : partie nulle (½-½)',
  DRAW_INSUFFICIENT_MATERIAL: 'Matériel insuffisant : partie nulle (½-½)',
  DRAW_FIFTY_MOVES: 'Règle des 50 coups : partie nulle (½-½)',
}

/** Message de l'état de la partie (P3, P7) : trait, échec, ou résultat avec sa raison. */
function statusMessage({ fen, status, ended }: Snapshot): string {
  if (ended) return ended
  const whiteToMove = fen.split(' ')[1] === 'w'
  if (status === 'CHECKMATE') {
    return whiteToMove ? 'Échec et mat : les Noirs gagnent (0-1)' : 'Échec et mat : les Blancs gagnent (1-0)'
  }
  const draw = DRAWS[status]
  if (draw) return draw
  const turn = whiteToMove ? 'Aux Blancs de jouer' : 'Aux Noirs de jouer'
  return status === 'CHECK' ? `Échec ! ${turn}` : turn
}

function isOver(status: GameStatus): boolean {
  return status !== 'ONGOING' && status !== 'CHECK'
}

/**
 * Écran du jeu d'échecs : affiche la position (FEN) et interroge le serveur, qui applique toutes les règles
 * (backend/.../games/echecs/). L'écran ne contient aucune règle d'échecs.
 */
/** Coups joués regroupés par numéro : « 1. e2-e4 e7-e5 » (P5, notation par cases de départ et d'arrivée). */
function numberedMoves(history: Snapshot[]): string[] {
  const moves = history.map((snapshot) => snapshot.move).filter((move): move is string => move !== null)
  const lines: string[] = []
  for (let i = 0; i < moves.length; i += 2) {
    lines.push(`${i / 2 + 1}. ${moves.slice(i, i + 2).join(' ')}`)
  }
  return lines
}

export default function EchecsGame(_props: GameProps) {
  const [history, setHistory] = useState<Snapshot[]>([START])
  const [flipped, setFlipped] = useState(false)
  const game = history[history.length - 1]
  const [selected, setSelected] = useState<string | null>(null)
  const [targets, setTargets] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [promotion, setPromotion] = useState<[string, string] | null>(null)
  const pieces = piecesFromFen(game.fen)
  const over = isOver(game.status) || game.ended !== null
  const whiteToMove = game.fen.split(' ')[1] === 'w'
  const kingInCheck =
    game.status === 'CHECK' || game.status === 'CHECKMATE'
      ? Object.keys(pieces).find((square) => pieces[square] === (whiteToMove ? 'K' : 'k'))
      : undefined

  /** Appelle le serveur ; en cas de refus (422) ou de panne, affiche le message prévu pour le joueur. */
  async function call(action: () => Promise<void>) {
    setError(null)
    try {
      await action()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur inattendue est survenue. Réessaie.')
    }
  }

  function select(square: string) {
    setSelected(square)
    void call(async () => setTargets(await destinations(game.fen, square)))
  }

  function moveTo(square: string) {
    const from = selected as string
    setSelected(null)
    setTargets([])
    const pawn = pieces[from]?.toLowerCase() === 'p'
    if (pawn && (square.endsWith('8') || square.endsWith('1'))) {
      setPromotion([from, square]) // P4 : le joueur choisit la pièce avant l'envoi
      return
    }
    send(from, square)
  }

  function send(from: string, to: string, letter?: Promotion) {
    void call(async () => {
      const result = letter ? await play(game.fen, from, to, letter) : await play(game.fen, from, to)
      const short = PROMOTIONS.find((p) => p.letter === letter)?.short
      const move = `${from}-${to}${short ? `=${short}` : ''}`
      setHistory((previous) => [...previous, { ...result, lastMove: [from, to], move, ended: null }])
    })
  }

  function promote(letter: Promotion) {
    const [from, to] = promotion as [string, string]
    setPromotion(null)
    send(from, to, letter)
  }

  function resetSelection() {
    setSelected(null)
    setTargets([])
    setPromotion(null)
    setError(null)
  }

  function newGame() {
    resetSelection()
    setHistory([START])
  }

  function undo() {
    resetSelection()
    setHistory((previous) => (previous.length > 1 ? previous.slice(0, -1) : previous))
  }

  /** Fin décidée par les joueurs : on l'ajoute comme une étape, que « Annuler le coup » peut retirer. */
  function end(message: string) {
    resetSelection()
    setHistory((previous) => [...previous, { ...game, move: null, ended: message }])
  }

  function resign() {
    end(
      whiteToMove
        ? 'Les Blancs abandonnent : les Noirs gagnent (0-1)'
        : 'Les Noirs abandonnent : les Blancs gagnent (1-0)',
    )
  }

  function handleClick(square: string) {
    if (over) return
    if (selected && targets.includes(square)) moveTo(square)
    else if (pieces[square]) select(square)
  }

  return (
    <div className="echecs">
      <section className="card">
        <h2>Échecs</h2>
        <p className="echecs-turn" role="status">
          {statusMessage(game)}
        </p>
        {error && (
          <p className="echecs-error" role="alert">
            {error}
          </p>
        )}
        {promotion && (
          <div className="echecs-promotion" role="dialog" aria-modal="true" aria-label="Promotion">
            <p>Promouvoir le pion en :</p>
            {PROMOTIONS.map(({ letter, name }) => (
              <button type="button" key={letter} onClick={() => promote(letter)}>
                {name}
              </button>
            ))}
            <button type="button" onClick={() => setPromotion(null)}>
              Annuler
            </button>
          </div>
        )}
        <div className="echecs-board" role="group" aria-label="Échiquier">
          {(flipped ? [...RANKS].reverse() : RANKS).map((rank) =>
            (flipped ? [...FILES].reverse() : FILES).map((file) => {
              const fileIndex = FILES.indexOf(file)
              const square = `${file}${rank}`
              const piece = pieces[square]
              const light = (fileIndex + rank) % 2 === 0 // h1 est une case claire
              const classes = [
                'echecs-square',
                light ? 'echecs-square-light' : 'echecs-square-dark',
                targets.includes(square) ? 'echecs-square-target' : '',
                game.lastMove?.includes(square) ? 'echecs-square-last' : '',
                square === kingInCheck ? 'echecs-square-check' : '',
              ]
              return (
                <button
                  type="button"
                  key={square}
                  className={classes.join(' ').trim()}
                  aria-label={squareLabel(square, piece)}
                  aria-pressed={selected === square}
                  onClick={() => handleClick(square)}
                >
                  {piece && (
                    <span
                      className={`echecs-piece ${isWhite(piece) ? 'echecs-piece-white' : 'echecs-piece-black'}`}
                      aria-hidden="true"
                    >
                      {SYMBOLS[piece.toLowerCase()]}
                    </span>
                  )}
                </button>
              )
            }),
          )}
        </div>
        <div className="echecs-actions">
          <button type="button" onClick={newGame}>
            Nouvelle partie
          </button>
          <button type="button" onClick={undo} disabled={history.length <= 1}>
            Annuler le coup
          </button>
          <button type="button" onClick={() => setFlipped((value) => !value)}>
            Retourner l’échiquier
          </button>
          <button type="button" onClick={resign} disabled={over}>
            Abandonner
          </button>
          <button type="button" onClick={() => end('Nulle par accord (½-½)')} disabled={over}>
            Nulle par accord
          </button>
        </div>
        {history.length > 1 && (
          <ol className="echecs-moves" aria-label="Coups joués">
            {numberedMoves(history).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}
