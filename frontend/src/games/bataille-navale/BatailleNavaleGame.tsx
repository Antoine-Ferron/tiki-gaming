import { useCallback, useEffect, useState } from 'react'
import { Leaderboard } from '@/components/Leaderboard'
import type { GameProps, LeaderboardEntry } from '../types'
import {
  GRID_SIZE,
  coordKey,
  fireAndSubmitIfOver,
  placeFleetRandomly,
  type Coord,
  type PlacedShip,
  type Ship,
} from './logic'
import './bataille-navale.css'

type Player = 1 | 2
type Phase = 'idle' | 'pass' | 'turn' | 'over'
type LastShot = { target: Coord; result: 'hit' | 'miss'; sunk?: Ship }

export default function BatailleNavaleGame({ ctx }: GameProps) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [current, setCurrent] = useState<Player>(1)
  const [fleet1, setFleet1] = useState<PlacedShip[]>([])
  const [fleet2, setFleet2] = useState<PlacedShip[]>([])
  const [shotsOn1, setShotsOn1] = useState<Set<string>>(new Set())
  const [shotsOn2, setShotsOn2] = useState<Set<string>>(new Set())
  const [lastShot, setLastShot] = useState<LastShot | null>(null)
  const [winner, setWinner] = useState<Player | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [error, setError] = useState<string | null>(null)

  const refreshLeaderboard = useCallback(() => {
    ctx
      .getLeaderboard(10)
      .then(setLeaderboard)
      .catch((e) => setError(e.message))
  }, [ctx])

  useEffect(() => {
    refreshLeaderboard()
  }, [refreshLeaderboard])

  function start() {
    setFleet1(placeFleetRandomly())
    setFleet2(placeFleetRandomly())
    setShotsOn1(new Set())
    setShotsOn2(new Set())
    setCurrent(1)
    setWinner(null)
    setLastShot(null)
    setError(null)
    setPhase('turn')
  }

  async function fire(target: Coord) {
    const opponentFleet = current === 1 ? fleet2 : fleet1
    const shots = current === 1 ? shotsOn2 : shotsOn1

    try {
      const outcome = await fireAndSubmitIfOver(opponentFleet, shots, target, (score, metadata) =>
        ctx.submitScore(score, { ...metadata, winner: current }),
      )
      if (outcome.result === 'repeat') return

      const nextShots = new Set(shots)
      if (current === 1) setShotsOn2(nextShots)
      else setShotsOn1(nextShots)
      setLastShot({ target, result: outcome.result, sunk: outcome.sunk })

      if (outcome.gameOver) {
        setWinner(current)
        setPhase('over')
        refreshLeaderboard()
      } else {
        setPhase('pass')
      }
    } catch (e) {
      setError((e as Error).message)
    }
  }

  function passToNext() {
    setCurrent((p) => (p === 1 ? 2 : 1))
    setLastShot(null)
    setPhase('turn')
  }

  const opponentFleet = current === 1 ? fleet2 : fleet1
  const myShots = current === 1 ? shotsOn2 : shotsOn1

  return (
    <div className="bataille-navale">
      {phase === 'idle' && (
        <div className="card bn-intro">
          <h2>Bataille navale</h2>
          <p>
            À deux, sur le même appareil. Chaque joueur reçoit une flotte placée au hasard. À tour de rôle, on tire sur
            la grille adverse jusqu'à couler toute la flotte de l'autre.
          </p>
          <button onClick={start}>Nouvelle partie</button>
        </div>
      )}

      {phase === 'pass' && (
        <div className="card bn-pass">
          <h2>Passe l'appareil au joueur {current === 1 ? 2 : 1}</h2>
          {lastShot && (
            <p className={lastShot.result === 'hit' ? 'success' : 'muted'}>
              {lastShot.sunk ? `${lastShot.sunk.name} coulé !` : lastShot.result === 'hit' ? 'Touché !' : "À l'eau."}
            </p>
          )}
          <button onClick={passToNext}>Je suis prêt</button>
        </div>
      )}

      {phase === 'turn' && (
        <div className="card bn-board">
          <h2>Au tour du joueur {current}</h2>
          <div className="bn-grid" role="grid" aria-label={`Grille du joueur ${current === 1 ? 2 : 1}`}>
            {Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, i) => {
              const target: Coord = { row: Math.floor(i / GRID_SIZE), col: i % GRID_SIZE }
              const key = coordKey(target)
              const shot = myShots.has(key)
              const hit = shot && opponentFleet.some((p) => p.coords.some((c) => coordKey(c) === key))
              return (
                <button
                  key={key}
                  className={`bn-cell${shot ? (hit ? ' hit' : ' miss') : ''}`}
                  disabled={shot}
                  onClick={() => fire(target)}
                  aria-label={`Case ${target.row + 1},${target.col + 1}`}
                />
              )
            })}
          </div>
          {error && <p className="error">{error}</p>}
        </div>
      )}

      {phase === 'over' && winner && (
        <div className="card bn-over">
          <h2>Le joueur {winner} a gagné !</h2>
          <button onClick={start}>Rejouer</button>
          {ctx.isGuest && <p className="muted">Connecte-toi pour apparaître au classement.</p>}
        </div>
      )}

      <div className="card">
        <h2>Classement</h2>
        <Leaderboard entries={leaderboard} currentUserId={ctx.player?.id} />
      </div>
    </div>
  )
}
