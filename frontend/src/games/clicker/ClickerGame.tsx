import { useCallback, useEffect, useRef, useState } from 'react'
import * as z from 'zod/mini'
import { Leaderboard } from '@/components/Leaderboard'
import type { GameProps, LeaderboardEntry } from '../types'

/**
 * Jeu d'exemple — sert de modèle aux équipes.
 * Montre : boucle de jeu simple, envoi de score, classement, sauvegarde,
 * et la gestion du mode invité (ctx.isGuest).
 */
const DURATION_MS = 10_000

// Schéma de la sauvegarde : une sauvegarde corrompue ou d'un ancien format est ignorée (loadSave renvoie null).
const saveSchema = z.object({ totalClicks: z.number().check(z.int(), z.nonnegative()) })
type Phase = 'idle' | 'playing' | 'over'

export default function ClickerGame({ ctx }: GameProps) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [clicks, setClicks] = useState(0)
  const [remaining, setRemaining] = useState(DURATION_MS)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [totalClicks, setTotalClicks] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const clicksRef = useRef(0)

  const refreshLeaderboard = useCallback(() => {
    ctx
      .getLeaderboard(10)
      .then(setLeaderboard)
      .catch((e) => setError(e.message))
  }, [ctx])

  useEffect(() => {
    refreshLeaderboard()
    ctx
      .loadSave(saveSchema)
      .then((s) => setTotalClicks(s?.totalClicks ?? 0))
      .catch((e) => setError(e.message))
  }, [ctx, refreshLeaderboard])

  const finish = useCallback(async () => {
    setPhase('over')
    const score = clicksRef.current
    // Les erreurs du SDK (GameError) ont un message destiné au joueur. Un échec d'envoi du score
    // n'empêche pas la sauvegarde, et inversement.
    try {
      await ctx.submitScore(score, { durationMs: DURATION_MS })
      refreshLeaderboard()
    } catch (e) {
      setError((e as Error).message)
    }
    const newTotal = totalClicks + score
    setTotalClicks(newTotal)
    try {
      await ctx.save({ totalClicks: newTotal })
    } catch (e) {
      setError((e as Error).message)
    }
  }, [ctx, totalClicks, refreshLeaderboard])

  useEffect(() => {
    if (phase !== 'playing') return
    const end = Date.now() + DURATION_MS
    const id = setInterval(() => {
      const left = Math.max(0, end - Date.now())
      setRemaining(left)
      if (left === 0) {
        clearInterval(id)
        void finish() // finish rattrape lui-même ses erreurs
      }
    }, 50)
    return () => clearInterval(id)
    // finish volontairement exclu : on ne relance pas le timer en cours de partie
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  function start() {
    clicksRef.current = 0
    setClicks(0)
    setRemaining(DURATION_MS)
    setError(null)
    setPhase('playing')
  }

  function click() {
    clicksRef.current += 1
    setClicks(clicksRef.current)
  }

  return (
    <div className="clicker">
      <div className="card clicker-board">
        {phase === 'playing' ? (
          <>
            <p className="timer">{(remaining / 1000).toFixed(1)} s</p>
            <button className="big" onClick={click}>
              {clicks}
            </button>
          </>
        ) : (
          <>
            {phase === 'over' && (
              <p className="result">
                Score : <strong>{clicks}</strong>
              </p>
            )}
            {phase === 'over' && ctx.isGuest && <p className="muted">Connecte-toi pour apparaître au classement.</p>}
            <button className="big" onClick={start}>
              {phase === 'over' ? 'Rejouer' : 'Jouer'}
            </button>
            <p className="muted">Clics cumulés (sauvegarde) : {totalClicks}</p>
          </>
        )}
        {error && <p className="error">{error}</p>}
      </div>
      <div className="card">
        <h2>Classement</h2>
        <Leaderboard entries={leaderboard} currentUserId={ctx.player?.id} />
      </div>
    </div>
  )
}
