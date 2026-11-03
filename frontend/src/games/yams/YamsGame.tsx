import { useCallback, useEffect, useRef, useState } from 'react'
import { Leaderboard } from '@/components/Leaderboard'
import type { GameProps, LeaderboardEntry } from '../types'
import {
  type Category,
  CATEGORY_LABELS,
  canReroll,
  type DieValue,
  type Game,
  isGameOver,
  LOWER_CATEGORIES,
  MAX_ROLLS,
  playCategory,
  roll,
  type RollDie,
  scoreCategory,
  toggleKeep,
  totalScore,
  UPPER_BONUS,
  UPPER_BONUS_THRESHOLD,
  UPPER_CATEGORIES,
  upperBonus,
  upperSubtotal,
  winner,
} from './logic'
import { finishGame, loadGame, saveGame } from './session'
import './yams.css'

/**
 * Écran du Yams : deux joueurs chacun son tour sur le même écran.
 * Aucune règle ici : tout vient de ./logic.ts (règles) et ./session.ts (plateforme), couverts par leurs tests.
 */
const randomDie: RollDie = () => (Math.floor(Math.random() * 6) + 1) as DieValue
const FACES = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅']

type Props = GameProps & { rollDie?: RollDie }

export default function YamsGame({ ctx, rollDie = randomDie }: Props) {
  const [game, setGame] = useState<Game | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const finished = useRef(false)
  const names = [ctx.player?.username ?? 'Joueur 1', 'Joueur 2']

  const refreshLeaderboard = useCallback(() => {
    ctx
      .getLeaderboard(10)
      .then(setLeaderboard)
      .catch((e: Error) => setError(e.message))
  }, [ctx])

  useEffect(() => {
    refreshLeaderboard()
    loadGame(ctx)
      .then(setGame)
      .catch((e: Error) => setError(e.message))
  }, [ctx, refreshLeaderboard])

  async function update(next: Game) {
    setGame(next)
    setError(null)
    try {
      if (isGameOver(next)) {
        if (finished.current) return
        finished.current = true
        await finishGame(ctx, next)
        refreshLeaderboard()
      } else {
        await saveGame(ctx, next)
      }
    } catch (e) {
      setError((e as Error).message)
    }
  }

  function restart() {
    finished.current = false
    void update({ sheets: [{}, {}], current: 0, turn: null })
  }

  if (!game) return <p className="muted">Chargement de la partie…</p>

  const { turn, current } = game
  const over = isGameOver(game)
  const won = winner(game)
  const rollsLeft = turn ? MAX_ROLLS - turn.rollsUsed : MAX_ROLLS

  function cell(category: Category, player: 0 | 1) {
    const value = game!.sheets[player][category]
    if (value !== undefined) return <td key={player}>{value}</td>
    if (player !== current || !turn || over) return <td key={player} className="muted" />
    return (
      <td key={player}>
        <button className="yams-choice" onClick={() => void update(playCategory(game!, category))}>
          {scoreCategory(turn.dice, category)}
        </button>
      </td>
    )
  }

  const row = (category: Category) => (
    <tr key={category}>
      <th scope="row">{CATEGORY_LABELS[category]}</th>
      {cell(category, 0)}
      {cell(category, 1)}
    </tr>
  )

  const totalRow = (label: string, value: (player: 0 | 1) => number) => (
    <tr className="yams-total">
      <th scope="row">{label}</th>
      <td>{value(0)}</td>
      <td>{value(1)}</td>
    </tr>
  )

  return (
    <div className="yams">
      <div className="card yams-board">
        {over ? (
          <>
            <p className="result">
              {won === null ? 'Égalité !' : `${names[won]} gagne !`} ({totalScore(game.sheets[0])} –{' '}
              {totalScore(game.sheets[1])})
            </p>
            {ctx.isGuest && <p className="muted">Connecte-toi pour apparaître au classement.</p>}
            <button className="yams-roll" onClick={restart}>
              Nouvelle partie
            </button>
          </>
        ) : (
          <>
            <p className="yams-turn">
              À <strong>{names[current]}</strong> de jouer
            </p>
            <div className="yams-dice">
              {turn
                ? turn.dice.map((die, i) => (
                    <button
                      key={i}
                      className="yams-die"
                      aria-pressed={turn.kept[i]}
                      aria-label={`Dé ${i + 1} : ${die}${turn.kept[i] ? ', gardé' : ''}`}
                      onClick={() => void update({ ...game, turn: toggleKeep(turn, i) })}
                    >
                      {FACES[die]}
                    </button>
                  ))
                : FACES.slice(1, 6).map((face, i) => (
                    <span key={i} className="yams-die muted" aria-hidden="true">
                      {face}
                    </span>
                  ))}
            </div>
            <button
              className="yams-roll"
              disabled={turn !== null && !canReroll(turn)}
              onClick={() => void update(roll(game, rollDie))}
            >
              {turn ? `Relancer (${rollsLeft})` : 'Lancer les dés'}
            </button>
            <p className="muted">
              {turn
                ? 'Clique sur un dé pour le garder, puis choisis une case.'
                : 'Lance les dés pour commencer ton tour.'}
            </p>
          </>
        )}
        {error && <p className="error">{error}</p>}
      </div>

      <div className="card">
        <table className="yams-sheet">
          <thead>
            <tr>
              <th scope="col">Case</th>
              {names.map((name, i) => (
                <th key={i} scope="col" className={!over && i === current ? 'yams-current' : undefined}>
                  {name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {UPPER_CATEGORIES.map(row)}
            {totalRow('Sous-total', (p) => upperSubtotal(game.sheets[p]))}
            {totalRow(`Bonus (${UPPER_BONUS} si ≥ ${UPPER_BONUS_THRESHOLD})`, (p) => upperBonus(game.sheets[p]))}
            {LOWER_CATEGORIES.map(row)}
            {totalRow('Total', (p) => totalScore(game.sheets[p]))}
          </tbody>
        </table>
        <p className="muted">Seul le score de {names[0]} compte pour le classement.</p>
      </div>

      <div className="card">
        <h2>Classement</h2>
        <Leaderboard entries={leaderboard} currentUserId={ctx.player?.id} />
      </div>
    </div>
  )
}
