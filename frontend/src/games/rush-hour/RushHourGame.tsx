import { useCallback, useEffect, useState } from 'react'
import { Leaderboard } from '@/components/Leaderboard'
import type { GameProps, LeaderboardEntry } from '../types'
import { LevelPicker } from './components/LevelPicker'
import { type FinishedRun, LevelPlayer } from './components/LevelPlayer'
import type { Difficulty } from './domain/difficulty'
import { generateBoard } from './domain/generator'
import { getLevel, levels } from './domain/levels'
import { levelScore } from './domain/score'
import { completeGenerated } from './services/completeGenerated'
import { completeLevel } from './services/completeLevel'
import { type LevelVerifier, serverVerifier } from './services/levelVerifier'
import { type Progress, loadProgress } from './services/progress'
import './rush-hour.css'

const DIFFICULTY_LABELS: Record<Difficulty, string> = { facile: 'Facile', moyen: 'Moyen', difficile: 'Difficile' }

type Screen =
  { kind: 'picker' } | { kind: 'level'; id: number } | { kind: 'generated'; difficulty: Difficulty; map: string[] }

type RushHourGameProps = GameProps & {
  /** Hasard du mode Génération : Math.random en jeu, une graine fixe dans les tests. */
  random?: () => number
  /** Vérification d'un niveau gagné : le serveur en jeu, une doublure dans les tests. */
  verifyLevel?: LevelVerifier
}

/** Jeu Rush Hour : écran de choix, partie sur un niveau ou un plateau généré, et classement à côté. */
export default function RushHourGame({ ctx, random = Math.random, verifyLevel = serverVerifier }: RushHourGameProps) {
  const [progress, setProgress] = useState<Progress | null>(null)
  const [screen, setScreen] = useState<Screen>({ kind: 'picker' })
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [message, setMessage] = useState<string | null>(null)

  const loadLeaderboard = useCallback(() => {
    ctx
      .getLeaderboard(10)
      .then(setLeaderboard)
      .catch((e: Error) => setMessage(e.message))
  }, [ctx])

  useEffect(() => {
    loadLeaderboard()
    loadProgress(ctx)
      .then(setProgress)
      .catch((e: Error) => {
        setProgress({ best: {} })
        setMessage(e.message)
      })
  }, [ctx, loadLeaderboard])

  const generate = (difficulty: Difficulty) =>
    setScreen({ kind: 'generated', difficulty, map: generateBoard(difficulty, random) })

  async function completeLevelRun(id: number, run: FinishedRun) {
    const { moves, hintsUsed, durationMs } = run
    const { score, best } = await completeLevel(ctx, { level: id, moves, hintsUsed, durationMs }, verifyLevel)
    setProgress((p) => ({ ...p, best }))
    loadLeaderboard()
    return score
  }

  async function completeGeneratedRun(difficulty: Difficulty, run: FinishedRun) {
    const score = levelScore({ moves: run.moves.length, optimal: run.optimal, hintsUsed: run.hintsUsed })
    const stats = await completeGenerated(ctx, { difficulty, score })
    setProgress((p) => ({ best: p?.best ?? {}, generated: { ...p?.generated, [difficulty]: stats } }))
    return score
  }

  function content() {
    if (progress === null) return <p className="muted">Chargement…</p>
    const back = () => setScreen({ kind: 'picker' })
    if (screen.kind === 'level') {
      const { id } = screen
      const hasNext = id < levels.length
      return (
        <LevelPlayer
          key={`niveau-${id}`}
          title={`Niveau ${id}`}
          map={getLevel(id).map}
          complete={(run) => completeLevelRun(id, run)}
          onBack={back}
          next={
            hasNext ? { label: 'Niveau suivant', onClick: () => setScreen({ kind: 'level', id: id + 1 }) } : undefined
          }
        />
      )
    }
    if (screen.kind === 'generated') {
      const { difficulty, map } = screen
      return (
        <LevelPlayer
          key={map.join('')}
          title={`Plateau ${DIFFICULTY_LABELS[difficulty]}`}
          map={map}
          complete={(run) => completeGeneratedRun(difficulty, run)}
          onBack={back}
          next={{ label: 'Nouveau plateau', onClick: () => generate(difficulty) }}
        />
      )
    }
    return <LevelPicker progress={progress} onPick={(id) => setScreen({ kind: 'level', id })} onGenerate={generate} />
  }

  return (
    <div className="rush-hour">
      <div className="card">
        {content()}
        {ctx.isGuest && <p className="muted">Connecte-toi pour apparaître au classement.</p>}
        {message && <p className="error">{message}</p>}
      </div>
      <div className="card">
        <h2>Classement</h2>
        <Leaderboard entries={leaderboard} currentUserId={ctx.player?.id} />
      </div>
    </div>
  )
}
