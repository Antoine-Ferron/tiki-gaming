import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
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
  type PlayerIndex,
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
const PLAYERS: readonly PlayerIndex[] = [0, 1]
const ALL_CATEGORIES: readonly Category[] = [...UPPER_CATEGORIES, ...LOWER_CATEGORIES]

/** Rappel de la règle sous chaque case, pour ne pas avoir à la connaître par cœur. */
const CATEGORY_HINTS: Record<Category, string> = {
  as: 'Somme des 1',
  deux: 'Somme des 2',
  trois: 'Somme des 3',
  quatre: 'Somme des 4',
  cinq: 'Somme des 5',
  six: 'Somme des 6',
  brelan: '3 dés identiques · somme des dés',
  carre: '4 dés identiques · somme des dés',
  full: '3 + 2 identiques · 25 pts',
  petiteSuite: '4 dés qui se suivent · 30 pts',
  grandeSuite: '5 dés qui se suivent · 40 pts',
  yams: '5 dés identiques · 50 pts',
  chance: 'Somme des dés',
}

/** Combinaisons annoncées sur la piste, de la plus forte à la plus faible. */
const COMBOS: readonly Category[] = ['yams', 'grandeSuite', 'full', 'carre', 'petiteSuite', 'brelan']

/** Annonce sous les dés : le libellé de la case, sauf le full qui a droit à son cri. */
const comboAnnouncement = (category: Category) =>
  category === 'full' ? 'FULL FULL FULLY' : `${CATEGORY_LABELS[category]} !`

/** Position des points sur une grille 3×3 (0 = en haut à gauche, 8 = en bas à droite). */
const PIPS: Record<DieValue, readonly number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
}

function DieFace({ value, rolling = false }: { value?: DieValue; rolling?: boolean }) {
  return (
    <span className={rolling ? 'yams-face yams-rolling' : 'yams-face'} aria-hidden="true">
      {Array.from({ length: 9 }, (_, cell) => (
        <span key={cell} className={value && PIPS[value].includes(cell) ? 'yams-pip' : undefined} />
      ))}
    </span>
  )
}

type Props = GameProps & { rollDie?: RollDie }

export default function YamsGame({ ctx, rollDie = randomDie }: Props) {
  const [game, setGame] = useState<Game | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  // Dés relancés au dernier lancer : eux seuls jouent l'animation.
  const [rolled, setRolled] = useState<readonly boolean[]>([])
  // Dernière case remplie, mise en valeur un court instant.
  const [lastPlayed, setLastPlayed] = useState<{ player: PlayerIndex; category: Category } | null>(null)
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

  function rollDice(current: Game) {
    setRolled(current.turn ? current.turn.kept.map((kept) => !kept) : [true, true, true, true, true])
    void update(roll(current, rollDie))
  }

  function play(current: Game, category: Category) {
    setLastPlayed({ player: current.current, category })
    void update(playCategory(current, category))
  }

  function restart() {
    finished.current = false
    setLastPlayed(null)
    void update({ sheets: [{}, {}], current: 0, turn: null })
  }

  if (!game) return <p className="muted">Chargement de la partie…</p>

  const { turn, current } = game
  const over = isGameOver(game)
  const won = winner(game)
  const rollsUsed = turn ? turn.rollsUsed : 0
  const activeColumn = (player: PlayerIndex) => (!over && player === current ? 'yams-col-active' : undefined)
  const filled = (player: PlayerIndex) => ALL_CATEGORIES.filter((c) => game.sheets[player][c] !== undefined).length

  const combo = turn ? COMBOS.find((category) => scoreCategory(turn.dice, category) > 0) : undefined
  // Case libre qui rapporte le plus avec les dés actuels. La chance n'est jamais conseillée :
  // elle rapporte souvent beaucoup, mais la garder en réserve est un choix du joueur.
  let best: Category | undefined
  if (turn && !over) {
    for (const category of ALL_CATEGORIES) {
      if (category === 'chance' || game.sheets[current][category] !== undefined) continue
      const points = scoreCategory(turn.dice, category)
      if (points > 0 && (!best || points > scoreCategory(turn.dice, best))) best = category
    }
  }

  function playerTag(player: PlayerIndex) {
    if (!over) return player === current ? 'À toi de jouer' : 'En attente'
    if (won === null) return 'Égalité'
    return won === player ? '🏆 Gagnant' : 'Perdu'
  }

  function cell(category: Category, player: PlayerIndex) {
    const value = game!.sheets[player][category]
    const classes = [activeColumn(player)]
    if (value !== undefined) {
      if (value === 0) classes.push('yams-scratched')
      if (lastPlayed?.player === player && lastPlayed.category === category) classes.push('yams-just-played')
      return (
        <td key={player} className={classes.filter(Boolean).join(' ') || undefined}>
          {value}
        </td>
      )
    }
    if (player !== current || !turn || over) return <td key={player} className={classes[0]} />
    const potential = scoreCategory(turn.dice, category)
    let choiceClass = 'yams-choice'
    if (potential === 0) choiceClass += ' yams-choice-zero'
    if (category === best) choiceClass += ' yams-choice-best'
    return (
      <td key={player} className={classes[0]}>
        <button className={choiceClass} onClick={() => play(game!, category)}>
          {potential}
        </button>
        {category === best && (
          <span className="yams-best-mark" aria-hidden="true" title="Meilleur coup">
            ★
          </span>
        )}
      </td>
    )
  }

  const row = (category: Category) => (
    <tr
      key={category}
      className={turn && !over && game.sheets[current][category] === undefined ? 'yams-open' : undefined}
    >
      <th scope="row">
        <span className="yams-label">{CATEGORY_LABELS[category]}</span>
        <span className="yams-label-hint">{CATEGORY_HINTS[category]}</span>
      </th>
      {PLAYERS.map((player) => cell(category, player))}
    </tr>
  )

  const section = (label: string) => (
    <tr className="yams-section">
      <th scope="colgroup" colSpan={3}>
        {label}
      </th>
    </tr>
  )

  const totalRow = (className: string, label: string, value: (player: PlayerIndex) => ReactNode) => (
    <tr className={className}>
      <th scope="row">{label}</th>
      {PLAYERS.map((player) => (
        <td key={player} className={activeColumn(player)}>
          {value(player)}
        </td>
      ))}
    </tr>
  )

  const subtotal = (player: PlayerIndex) => {
    const points = upperSubtotal(game.sheets[player])
    return (
      <>
        {points} / {UPPER_BONUS_THRESHOLD}
        <span className="yams-bonus-bar" aria-hidden="true">
          <span style={{ width: `${Math.min(100, (points / UPPER_BONUS_THRESHOLD) * 100)}%` }} />
        </span>
      </>
    )
  }

  return (
    <div className="yams">
      <div className="card yams-board">
        <div className="yams-players">
          {PLAYERS.map((player) => (
            <div
              key={player}
              className="yams-player"
              data-active={!over && player === current}
              data-winner={over && player === won}
            >
              <span className="yams-avatar" aria-hidden="true">
                {names[player].charAt(0).toUpperCase()}
              </span>
              <span className="yams-player-info">
                <span className="yams-player-tag">{playerTag(player)}</span>
                <span className="yams-player-name">{names[player]}</span>
                <span className="yams-player-progress">
                  {filled(player)} / {ALL_CATEGORIES.length} cases
                </span>
              </span>
              <span className="yams-player-score">{totalScore(game.sheets[player])}</span>
            </div>
          ))}
        </div>

        <div className="yams-tray">
          {over ? (
            <div className="yams-end">
              <span className="yams-trophy" aria-hidden="true">
                {won === null ? '🤝' : '🏆'}
              </span>
              <p className="yams-result" aria-live="polite">
                {won === null ? 'Égalité !' : `${names[won]} gagne !`}
              </p>
              <p className="yams-final">
                {totalScore(game.sheets[0])} – {totalScore(game.sheets[1])}
              </p>
              {ctx.isGuest && <p className="muted yams-hint">Connecte-toi pour apparaître au classement.</p>}
              <button className="yams-roll" onClick={restart}>
                Nouvelle partie
              </button>
            </div>
          ) : (
            <>
              <p className="yams-turn" aria-live="polite">
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
                        <DieFace key={turn.rollsUsed} value={die} rolling={rolled[i]} />
                      </button>
                    ))
                  : Array.from({ length: 5 }, (_, i) => (
                      <span key={i} className="yams-die yams-die-idle" aria-hidden="true">
                        <DieFace />
                      </span>
                    ))}
              </div>
              <p className="yams-combo-slot">
                {combo && (
                  <span
                    key={turn!.dice.join('')}
                    className={combo === 'yams' ? 'yams-combo yams-combo-yams' : 'yams-combo'}
                  >
                    {comboAnnouncement(combo)}
                  </span>
                )}
              </p>
              <div className="yams-controls">
                <button
                  className="yams-roll"
                  disabled={turn !== null && !canReroll(turn)}
                  onClick={() => rollDice(game)}
                >
                  {turn ? `Relancer (${MAX_ROLLS - rollsUsed})` : 'Lancer les dés'}
                </button>
                <span className="yams-rolls-left" aria-hidden="true" title="Lancers restants">
                  {Array.from({ length: MAX_ROLLS }, (_, i) => (
                    <span key={i} data-used={i < rollsUsed} />
                  ))}
                </span>
              </div>
              <p className="muted yams-hint">
                {turn
                  ? 'Clique sur un dé pour le garder, puis choisis une case. ★ = meilleur coup.'
                  : 'Lance les dés pour commencer ton tour.'}
              </p>
            </>
          )}
          {error && <p className="error">{error}</p>}
        </div>
      </div>

      <div className="card yams-sheet-card">
        <h2>Feuille de score</h2>
        <table className="yams-sheet">
          <thead>
            <tr>
              <th scope="col">Case</th>
              {PLAYERS.map((player) => (
                <th key={player} scope="col" className={activeColumn(player)}>
                  {names[player]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {section('Section haute')}
            {UPPER_CATEGORIES.map(row)}
            {totalRow('yams-subtotal', 'Sous-total', subtotal)}
            {totalRow('yams-subtotal', `Bonus (+${UPPER_BONUS} si ≥ ${UPPER_BONUS_THRESHOLD})`, (p) => {
              const bonus = upperBonus(game.sheets[p])
              return bonus > 0 ? <span className="yams-bonus-ok">+{bonus}</span> : bonus
            })}
            {section('Section basse')}
            {LOWER_CATEGORIES.map(row)}
            {totalRow('yams-total', 'Total', (p) => totalScore(game.sheets[p]))}
          </tbody>
        </table>
        <p className="muted yams-note">Seul le score de {names[0]} compte pour le classement.</p>
      </div>

      <div className="card yams-ranking">
        <h2>Classement</h2>
        <Leaderboard entries={leaderboard} currentUserId={ctx.player?.id} />
      </div>
    </div>
  )
}
