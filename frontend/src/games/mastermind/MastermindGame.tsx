import { useCallback, useEffect, useState } from 'react'
import { Leaderboard } from '@/components/Leaderboard'
import { apiPost } from '@/lib/api'
import type { GameProps, LeaderboardEntry } from '../types'

const COLORS = [
  { id: 'red', label: 'Rouge' },
  { id: 'blue', label: 'Bleu' },
  { id: 'green', label: 'Vert' },
  { id: 'yellow', label: 'Jaune' },
  { id: 'orange', label: 'Orange' },
  { id: 'purple', label: 'Violet' },
] as const
const CODE_LENGTH = 4

type ColorId = (typeof COLORS)[number]['id']
type Guess = (ColorId | null)[]
type MastermindStatus = 'IN_PROGRESS' | 'WON' | 'LOST'
type Feedback = { exact: number; misplaced: number }
type Attempt = { guess: ColorId[]; feedback: Feedback }
type MastermindGameState = {
  id: string
  status: MastermindStatus
  attemptsUsed: number
  attemptsRemaining: number
  history: Attempt[]
  secret: ColorId[] | null
  score: number
}

const emptyGuess = (): Guess => Array(CODE_LENGTH).fill(null)

export default function MastermindGame({ ctx }: GameProps) {
  const [game, setGame] = useState<MastermindGameState | null>(null)
  const [guess, setGuess] = useState<Guess>(emptyGuess)
  const [activeSlot, setActiveSlot] = useState(0)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refreshLeaderboard = useCallback(async () => {
    try {
      setLeaderboard(await ctx.getLeaderboard(10))
    } catch (e) {
      setError((e as Error).message)
    }
  }, [ctx])

  useEffect(() => {
    void apiPost<MastermindGameState>('/games')
      .then((createdGame) => {
        setGame(createdGame)
        setGuess(emptyGuess())
        setActiveSlot(0)
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false))
    void ctx
      .getLeaderboard(10)
      .then(setLeaderboard)
      .catch((e) => setError((e as Error).message))
  }, [ctx])

  function chooseColor(color: ColorId) {
    if (!game || game.status !== 'IN_PROGRESS' || submitting) return
    setGuess((current) => {
      const next = [...current]
      next[activeSlot] = color
      return next
    })
    setActiveSlot((slot) => (slot + 1) % CODE_LENGTH)
  }

  async function submitGuess() {
    if (!game || submitting || guess.some((color) => color === null)) return
    setSubmitting(true)
    setError(null)
    try {
      const updatedGame = await apiPost<MastermindGameState>(`/games/${game.id}/guesses`, { colors: guess })
      setGame(updatedGame)
      setGuess(emptyGuess())
      setActiveSlot(0)
      if (updatedGame.status === 'WON') {
        if (typeof updatedGame.score !== 'number' || !Number.isInteger(updatedGame.score) || updatedGame.score < 1) {
          throw new Error('Le backend n’a pas renvoyé un score valide pour cette victoire.')
        }
        await ctx.submitScore(updatedGame.score, { attempts: updatedGame.attemptsUsed })
        await refreshLeaderboard()
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  async function restart() {
    if (!game || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      setGame(await apiPost<MastermindGameState>(`/games/${game.id}/restart`))
      setGuess(emptyGuess())
      setActiveSlot(0)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  const colorLabel = (color: ColorId) => COLORS.find((item) => item.id === color)?.label ?? color
  const isFinished = game?.status !== 'IN_PROGRESS'

  return (
    <div className="mastermind">
      <div className="card mastermind-board">
        {loading || !game ? (
          <p className="muted">Création de la partie…</p>
        ) : (
          <>
            <div className="mastermind-heading">
              <div>
                <h2>Décode la combinaison</h2>
                <p className="muted">
                  {game.attemptsRemaining} tentative{game.attemptsRemaining > 1 ? 's' : ''} restante
                  {game.attemptsRemaining > 1 ? 's' : ''}
                </p>
              </div>
              <button className="small" onClick={restart} disabled={submitting}>
                Nouvelle partie
              </button>
            </div>

            <div className="mastermind-attempts" aria-label="Tentatives précédentes">
              {game.history.map((attempt, index) => (
                <div className="mastermind-row" key={`${index}-${attempt.guess.join('-')}`}>
                  <span className="attempt-number">{index + 1}</span>
                  <div className="color-slots">
                    {attempt.guess.map((color, colorIndex) => (
                      <span className={`color-dot ${color}`} title={colorLabel(color)} key={`${color}-${colorIndex}`} />
                    ))}
                  </div>
                  <div
                    className="feedback"
                    aria-label={`${attempt.feedback.exact} noir, ${attempt.feedback.misplaced} blanc`}
                  >
                    {Array.from({ length: attempt.feedback.exact }, (_, feedbackIndex) => (
                      <span className="feedback-dot exact" key={`exact-${feedbackIndex}`} />
                    ))}
                    {Array.from({ length: attempt.feedback.misplaced }, (_, feedbackIndex) => (
                      <span className="feedback-dot misplaced" key={`misplaced-${feedbackIndex}`} />
                    ))}
                  </div>
                </div>
              ))}
              {!isFinished && (
                <div className="mastermind-row current-row">
                  <span className="attempt-number">{game.attemptsUsed + 1}</span>
                  <div className="color-slots">
                    {guess.map((color, index) => (
                      <button
                        className={`color-slot ${color ?? ''} ${activeSlot === index ? 'selected' : ''}`}
                        onClick={() => setActiveSlot(index)}
                        aria-label={color ? `${colorLabel(color)}, cliquer pour modifier` : `Emplacement ${index + 1}`}
                        key={index}
                      />
                    ))}
                  </div>
                  <span className="feedback-placeholder" />
                </div>
              )}
            </div>

            {isFinished && (
              <div className={`mastermind-result ${game.status === 'WON' ? 'success' : 'error'}`}>
                <strong>{game.status === 'WON' ? 'Bravo, combinaison trouvée !' : 'Partie terminée.'}</strong>
                {game.status === 'WON' && (
                  <p>
                    Score de la partie : <strong>{game.score}</strong> point{game.score === 1 ? '' : 's'}
                  </p>
                )}
                <p>
                  Le code était :{' '}
                  {game.secret?.map((color, index) => (
                    <span className={`color-dot ${color}`} title={colorLabel(color)} key={`${color}-${index}`} />
                  ))}
                </p>
              </div>
            )}

            {!isFinished && (
              <>
                <div className="color-picker" aria-label="Choisir une couleur">
                  {COLORS.map((color) => (
                    <button
                      className={`color-choice ${color.id}`}
                      onClick={() => chooseColor(color.id)}
                      disabled={submitting}
                      key={color.id}
                    >
                      <span className="color-dot" />
                      {color.label}
                    </button>
                  ))}
                </div>
                <button onClick={submitGuess} disabled={submitting || guess.some((color) => color === null)}>
                  Valider la combinaison
                </button>
                <p className="muted mastermind-help">
                  Noir : bonne couleur au bon endroit · Blanc : bonne couleur au mauvais endroit
                </p>
              </>
            )}
            {isFinished && (
              <button onClick={restart} disabled={submitting}>
                Rejouer
              </button>
            )}
          </>
        )}
        {error && <p className="error">{error}</p>}
      </div>
      <div className="card">
        <h2 className="leaderboard-heading">
          <span>Classement (meilleur score)</span>
          <span
            className="info-tooltip"
            tabIndex={0}
            role="img"
            aria-label="Règle de calcul des points"
            data-tooltip="Score = 11 moins le nombre de tentatives. De 10 points en 1 tentative à 1 point en 10 tentatives."
          >
            i
          </span>
        </h2>
        <p className="muted">Plus le score est élevé, meilleure est la performance.</p>
        <Leaderboard entries={leaderboard} currentUserId={ctx.player?.id} />
      </div>
    </div>
  )
}
