import { useCallback, useEffect, useRef, useState } from 'react'
import { Leaderboard } from '@/components/Leaderboard'
import { GameError } from '../errors'
import type { GameProps, LeaderboardEntry } from '../types'
import { Grid } from './components/Grid'
import type { Direction } from './domain/board'
import { keepPlaying, newGame, play, type GameState } from './domain/game'
import { randomSpawner, type TileSpawner } from './domain/spawner'
import { keyToDirection } from './keyboard'
import { finishGame, loadRecord } from './services/finishGame'
import './game-2048.css'

type Props = GameProps & {
  /** Remplaçable en test (stub) ; par défaut, le hasard du navigateur. */
  spawner?: TileSpawner
  /** Partie de départ, pour les tests ; par défaut, une nouvelle partie. */
  initialGame?: GameState
}

type Message = { text: string; kind: 'error' | 'notice' }

export default function Game2048Game({ ctx, spawner: injected, initialGame }: Props) {
  const [spawner] = useState(() => injected ?? randomSpawner())
  const [game, setGame] = useState(() => initialGame ?? newGame(spawner))
  const [record, setRecord] = useState(0)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [message, setMessage] = useState<Message | null>(null)
  const current = useRef(game)

  const update = (next: GameState) => {
    current.current = next
    setGame(next)
  }

  const refreshLeaderboard = useCallback(() => {
    ctx
      .getLeaderboard(10)
      .then(setLeaderboard)
      .catch((e: Error) => setMessage({ text: e.message, kind: 'error' }))
  }, [ctx])

  useEffect(() => {
    loadRecord(ctx).then(setRecord, () => setRecord(0))
    refreshLeaderboard()
  }, [ctx, refreshLeaderboard])

  const end = useCallback(
    async (finished: GameState) => {
      try {
        const { best } = await finishGame(ctx, finished)
        setRecord(best)
      } catch (err) {
        const queued = err instanceof GameError && err.code === 'queued'
        if (queued) setRecord((best) => Math.max(best, finished.score))
        setMessage({ text: (err as Error).message, kind: queued ? 'notice' : 'error' })
      }
      refreshLeaderboard()
    },
    [ctx, refreshLeaderboard],
  )

  const move = useCallback(
    (direction: Direction) => {
      const next = play(current.current, direction, spawner)
      if (next === current.current) return
      update(next)
      if (next.status === 'lost') void end(next)
    },
    [spawner, end],
  )

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const direction = keyToDirection(event.key)
      if (!direction) return
      event.preventDefault()
      move(direction)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [move])

  function restart() {
    const previous = current.current
    setMessage(null)
    update(newGame(spawner))
    // Abandonner une partie entamée la termine : son score compte (F4).
    if (previous.status !== 'lost' && previous.score > 0) void end(previous)
  }

  return (
    <div className="game-2048">
      <div className="card game-2048-board">
        <div className="game-2048-scores">
          <p>Score : {game.score}</p>
          <p className="muted">Record : {record}</p>
        </div>

        <Grid grid={game.grid} />

        {game.status === 'won' && (
          <div className="game-2048-end" role="status">
            <p className="success">Tu as gagné !</p>
            <button type="button" onClick={() => update(keepPlaying(current.current))}>
              Continuer
            </button>
          </div>
        )}
        {game.status === 'lost' && (
          <p className="game-2048-end" role="status">
            Partie terminée
          </p>
        )}
        {message && <p className={message.kind}>{message.text}</p>}

        <button type="button" className="secondary" onClick={restart}>
          Nouvelle partie
        </button>
        <p className="muted">Joue avec les flèches, ZQSD ou WASD.</p>
        {ctx.isGuest && <p className="muted">Connecte-toi pour apparaître au classement.</p>}
      </div>
      <div className="card">
        <h2>Classement</h2>
        <Leaderboard entries={leaderboard} currentUserId={ctx.player?.id} />
      </div>
    </div>
  )
}
