import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { Leaderboard } from '@/components/Leaderboard'
import type { GameProps, LeaderboardEntry } from '../types'
import { canPlay } from './domain/device'
import { newSave, saveSchema, type MiniGtaSave } from './domain/save'
import './mini-gta.css'
import { formatMoney } from './domain/format'

// Le moteur (Three.js, cannon-es) n'est téléchargé qu'au lancement de la partie.
const MiniGtaPlay = lazy(() => import('./MiniGtaPlay'))

function detectDevice() {
  const finePointer = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: fine)').matches
  return { finePointer, width: window.innerWidth }
}

/** Écran d'accueil de MiniGTA : progression sauvegardée, classement, lancement de la partie. */
export default function MiniGtaGame({ ctx }: GameProps) {
  const [save, setSave] = useState<MiniGtaSave | null>(null)
  const [hasSave, setHasSave] = useState(false)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [playing, setPlaying] = useState<{ best: number | null } | null>(null)
  const [playable] = useState(() => canPlay(detectDevice()))

  const refreshLeaderboard = useCallback(() => {
    ctx
      .getLeaderboard(10)
      .then(setLeaderboard)
      .catch((e: Error) => setError(e.message))
  }, [ctx])

  useEffect(() => {
    refreshLeaderboard()
    ctx
      .loadSave(saveSchema)
      .then((s) => {
        setHasSave(s !== null)
        setSave(s ?? newSave())
      })
      .catch((e: Error) => {
        setError(e.message)
        setSave(newSave())
      })
  }, [ctx, refreshLeaderboard])

  async function play() {
    setError(null)
    let best: number | null = null
    try {
      best = (await ctx.getMyBest())?.best_score ?? null
    } catch (e) {
      setError((e as Error).message)
    }
    setPlaying({ best })
  }

  function exit(progress: MiniGtaSave) {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    setSave(progress)
    setHasSave(true)
    setPlaying(null)
    refreshLeaderboard()
  }

  const board = (
    <div className="card">
      <h2>Classement</h2>
      <p className="muted">Argent gagné au total.</p>
      <Leaderboard entries={leaderboard} currentUserId={ctx.player?.id} />
    </div>
  )

  if (playing && save) {
    return (
      <div className="mini-gta">
        <div className="card mini-gta-stage">
          <Suspense fallback={<p className="muted">Chargement du moteur…</p>}>
            <MiniGtaPlay ctx={ctx} save={save} best={playing.best} onExit={exit} />
          </Suspense>
        </div>
        {board}
      </div>
    )
  }

  return (
    <div className="mini-gta">
      <div className="card mini-gta-home">
        {save === null ? (
          <p className="muted">Chargement…</p>
        ) : (
          <>
            {hasSave && (
              <dl className="mini-gta-save">
                <dt>Argent</dt>
                <dd>{formatMoney(save.money)}</dd>
                <dt>Gagné au total</dt>
                <dd>{formatMoney(save.totalEarned)}</dd>
                <dt>Missions</dt>
                <dd>{save.completedMissions.length} / 4</dd>
              </dl>
            )}
            {playable ? (
              <>
                <button className="big" onClick={() => void play()}>
                  {hasSave ? 'Continuer' : 'Jouer'}
                </button>
                <p className="muted">Clavier et souris. Échap met le jeu en pause.</p>
              </>
            ) : (
              <p className="notice">Ce jeu se joue au clavier et à la souris, sur ordinateur.</p>
            )}
            {ctx.isGuest && <p className="muted">Connecte-toi pour apparaître au classement.</p>}
          </>
        )}
        {error && <p className="error">{error}</p>}
      </div>
      {board}
    </div>
  )
}
