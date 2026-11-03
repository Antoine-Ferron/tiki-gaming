import { useEffect, useState } from 'react'
import { Leaderboard } from '@/components/Leaderboard'
import type { GameProps, LeaderboardEntry } from '../types'
import { canPlay } from './domain/device'
import { newSave, saveSchema, type MiniGtaSave } from './domain/save'
import './mini-gta.css'

const money = (n: number) => `${n.toLocaleString('fr-FR')} $`

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
  const [launched, setLaunched] = useState(false)
  const [playable] = useState(() => canPlay(detectDevice()))

  useEffect(() => {
    ctx
      .getLeaderboard(10)
      .then(setLeaderboard)
      .catch((e: Error) => setError(e.message))
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
  }, [ctx])

  return (
    <div className="mini-gta">
      <div className="card mini-gta-home">
        {save === null ? (
          <p className="muted">Chargement…</p>
        ) : (
          <>
            {hasSave && (
              <dl className="mini-gta-progress">
                <dt>Argent</dt>
                <dd>{money(save.money)}</dd>
                <dt>Gagné au total</dt>
                <dd>{money(save.totalEarned)}</dd>
                <dt>Missions</dt>
                <dd>{save.completedMissions.length} / 4</dd>
              </dl>
            )}
            {playable ? (
              <>
                <button className="big" onClick={() => setLaunched(true)}>
                  {hasSave ? 'Continuer' : 'Jouer'}
                </button>
                <p className="muted">Clavier et souris. Échap met le jeu en pause.</p>
              </>
            ) : (
              <p className="notice">Ce jeu se joue au clavier et à la souris, sur ordinateur.</p>
            )}
            {launched && <p className="notice">La ville est en cours de construction : reviens bientôt.</p>}
            {ctx.isGuest && <p className="muted">Connecte-toi pour apparaître au classement.</p>}
          </>
        )}
        {error && <p className="error">{error}</p>}
      </div>
      <div className="card">
        <h2>Classement</h2>
        <p className="muted">Argent gagné au total.</p>
        <Leaderboard entries={leaderboard} currentUserId={ctx.player?.id} />
      </div>
    </div>
  )
}
