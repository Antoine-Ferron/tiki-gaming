import { useState } from 'react'
import { ApiError } from '@/lib/api'
import type { GameProps } from '../types'
import { destinations, type GameStatus, play, type Promotion } from './api'
import { FILES, isWhite, piecesFromFen, RANKS, squareLabel, START_FEN, SYMBOLS } from './board'
import './echecs.css'

/** Une position de la partie, telle que renvoyée par le serveur. */
type Snapshot = { fen: string; status: GameStatus; lastMove: [string, string] | null }

const START: Snapshot = { fen: START_FEN, status: 'ONGOING', lastMove: null }

const PROMOTIONS: { letter: Promotion; name: string }[] = [
  { letter: 'q', name: 'Dame' },
  { letter: 'r', name: 'Tour' },
  { letter: 'b', name: 'Fou' },
  { letter: 'n', name: 'Cavalier' },
]

const DRAWS: Partial<Record<GameStatus, string>> = {
  STALEMATE: 'Pat : partie nulle (½-½)',
  DRAW_INSUFFICIENT_MATERIAL: 'Matériel insuffisant : partie nulle (½-½)',
  DRAW_FIFTY_MOVES: 'Règle des 50 coups : partie nulle (½-½)',
}

/** Message de l'état de la partie (P3, P7) : trait, échec, ou résultat avec sa raison. */
function statusMessage({ fen, status }: Snapshot): string {
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
export default function EchecsGame(_props: GameProps) {
  const [game, setGame] = useState<Snapshot>(START)
  const [selected, setSelected] = useState<string | null>(null)
  const [targets, setTargets] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [promotion, setPromotion] = useState<[string, string] | null>(null)
  const pieces = piecesFromFen(game.fen)
  const over = isOver(game.status)
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
      setGame({ ...result, lastMove: [from, to] })
    })
  }

  function promote(letter: Promotion) {
    const [from, to] = promotion as [string, string]
    setPromotion(null)
    send(from, to, letter)
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
          {RANKS.map((rank) =>
            FILES.map((file, fileIndex) => {
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
      </section>
    </div>
  )
}
