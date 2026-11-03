import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { Leaderboard } from '@/components/Leaderboard'
import type { GameContext, GameProps, LeaderboardEntry } from '../types'
import { randomShuffler, standardTrade } from './adapters'
import { chooseAction } from './ai'
import { fillWithBots } from './bots'
import { CardFace } from './CardFace'
import { createGame, payment, playTurn, shields, TURNS_PER_AGE, type Action, type PlayerState } from './game'
import type { Shuffler } from './ports'
import { Results } from './Results'
import { ranking } from './score'
import { neighbours } from './setup'
import './sdv-civilisation.css'

const AGES = ['I', 'II', 'III']
// Rayons de l'ellipse sur laquelle sont posés les sièges, en % de la table.
const SEAT_RADIUS_X = 41
const SEAT_RADIUS_Y = 39
const ME = 0

/**
 * Place le siège `index` autour de la table : le joueur 0 en bas, les suivants dans le sens inverse des
 * aiguilles d'une montre, pour que le voisin de droite (index + 1) soit à droite à l'écran.
 */
function seatPosition(index: number, count: number): CSSProperties {
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / count
  return {
    left: `${50 + SEAT_RADIUS_X * Math.cos(angle)}%`,
    top: `${50 - SEAT_RADIUS_Y * Math.sin(angle)}%`,
  }
}

function seatLabel(seat: PlayerState, isMe: boolean, left: PlayerState, right: PlayerState): string {
  const name = isMe ? `${seat.name} (toi)` : seat.name
  const coins = `${seat.coins} pièce${seat.coins > 1 ? 's' : ''}`
  return `${name}, ${coins}, voisin de gauche ${left.name}, voisin de droite ${right.name}`
}

/** Bascule le plateau en plein écran (API Fullscreen du navigateur). */
function useFullscreen(ref: RefObject<HTMLElement | null>) {
  const [active, setActive] = useState(false)

  useEffect(() => {
    const onChange = () => setActive(document.fullscreenElement === ref.current)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [ref])

  const toggle = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void ref.current?.requestFullscreen()
  }

  return { active, supported: Boolean(document.fullscreenEnabled), toggle }
}

/**
 * Partie contre deux IA. Le mélangeur est injectable : aléatoire en production, ordre fixe dans les tests.
 * Voir docs/games/sdv-civilisation/regles.md#version-contre-ia
 */
export function SdvCivilisationBoard({ ctx, shuffler }: { ctx: GameContext; shuffler: Shuffler }) {
  const me = ctx.player?.username ?? 'Toi'
  const newGame = () => createGame(fillWithBots([me]), shuffler)
  const [game, setGame] = useState(newGame)
  // Position de la carte choisie dans la main (une main peut contenir deux exemplaires de la même carte).
  const [selected, setSelected] = useState<number | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const boardRef = useRef<HTMLDivElement>(null)
  const fullscreen = useFullscreen(boardRef)

  useEffect(() => {
    ctx
      .getLeaderboard(10)
      .then(setLeaderboard)
      .catch((e) => setError(e.message))
  }, [ctx])

  // Fin de partie : le score du joueur est envoyé une fois, puis le classement est rafraîchi.
  useEffect(() => {
    if (!game.over) return
    const mine = ranking(game.players).find((row) => row.name === me)!
    ctx
      .submitScore(mine.score.total, { ...mine.score })
      .then(() => ctx.getLeaderboard(10))
      .then(setLeaderboard)
      .catch((e) => setError(e.message))
  }, [ctx, game, me])

  const hand = game.hands[ME]
  const selectedCard = selected === null ? undefined : hand[selected]
  const cost = selectedCard && payment(game, ME, selectedCard, standardTrade)

  function play(action: Action) {
    const actions = game.players.map((_, i) => (i === ME ? action : chooseAction(game, i, standardTrade)))
    setGame(playTurn(game, actions, standardTrade, shuffler))
    setSelected(null)
  }

  function replay() {
    setGame(newGame())
    setError(null)
  }

  return (
    <div className="sdv-civilisation">
      <div ref={boardRef} className="sdv-civilisation-board">
        <div className="sdv-civilisation-toolbar">
          <p className="sdv-civilisation-status">
            Âge <strong>{AGES[game.age - 1]}</strong> · Tour <strong>{game.turn}</strong> / {TURNS_PER_AGE}
          </p>
          {fullscreen.supported && (
            <button type="button" className="small" onClick={fullscreen.toggle}>
              {fullscreen.active ? 'Quitter le plein écran' : 'Plein écran'}
            </button>
          )}
        </div>

        <div className="sdv-civilisation-table">
          <div className="sdv-civilisation-felt">
            <p className="sdv-civilisation-age">Âge {AGES[game.age - 1]}</p>
            <div className="sdv-civilisation-decks" aria-hidden="true">
              {AGES.map((age, index) => (
                <span
                  key={age}
                  className={`sdv-civilisation-deck${index === game.age - 1 ? ' sdv-civilisation-deck-current' : ''}`}
                >
                  {age}
                </span>
              ))}
            </div>
            <p className="sdv-civilisation-direction">
              <span aria-hidden="true">{game.age === 2 ? '↺' : '↻'}</span> Passage à{' '}
              {game.age === 2 ? 'droite' : 'gauche'}
            </p>
          </div>

          <ul className="sdv-civilisation-seats" aria-label="Table de jeu">
            {game.players.map((seat, index) => {
              const { left, right } = neighbours(game.players, index)
              const isMe = index === ME
              return (
                <li
                  key={seat.name}
                  className={`sdv-civilisation-seat${isMe ? ' sdv-civilisation-seat-me' : ''}`}
                  style={seatPosition(index, game.players.length)}
                  aria-label={seatLabel(seat, isMe, left, right)}
                >
                  <div className="sdv-civilisation-seat-head" aria-hidden="true">
                    <span className="sdv-civilisation-avatar">
                      {seat.isBot ? 'IA' : seat.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="sdv-civilisation-name">{isMe ? 'Toi' : seat.name}</span>
                  </div>
                  <div className="sdv-civilisation-stats" aria-hidden="true">
                    <span title="Pièces">
                      <span className="sdv-civilisation-coin" />
                      {seat.coins}
                    </span>
                    <span title="Boucliers">⚔ {shields(seat)}</span>
                    <span title="Jetons militaires">★ {seat.military}</span>
                  </div>
                  <div className="sdv-civilisation-built" aria-hidden="true" title="Cartes construites">
                    {seat.built.map((card, i) => (
                      <span key={i} className={`sdv-civilisation-chip sdv-civilisation-card-${card.color}`} />
                    ))}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>

        {game.over ? (
          <Results ranked={ranking(game.players)} me={me} isGuest={ctx.isGuest} onReplay={replay} />
        ) : (
          <div className="sdv-civilisation-hand">
            <p className="sdv-civilisation-hand-title">Ta main · choisis une carte</p>
            <div className="sdv-civilisation-cards">
              {hand.map((card, i) => (
                <CardFace
                  key={`${i}-${card.name}`}
                  card={card}
                  selected={i === selected}
                  offset={i - (hand.length - 1) / 2}
                  onSelect={() => setSelected(i)}
                />
              ))}
            </div>
            {selectedCard && cost && (
              <div className="sdv-civilisation-actions">
                <button
                  type="button"
                  disabled={!cost.ok}
                  onClick={() => play({ type: 'build', card: selectedCard.name })}
                >
                  Construire {selectedCard.name}
                  {cost.ok && cost.coins > 0 ? ` (${cost.coins} pièce${cost.coins > 1 ? 's' : ''})` : ''}
                </button>
                <button
                  type="button"
                  className="link"
                  onClick={() => play({ type: 'discard', card: selectedCard.name })}
                >
                  Défausser (+3 pièces)
                </button>
                {!cost.ok && <p className="error">{cost.reason}</p>}
              </div>
            )}
          </div>
        )}

        {game.log.length > 0 && (
          <ul className="sdv-civilisation-log" aria-label="Dernier tour">
            {game.log.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
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

export default function SdvCivilisationGame({ ctx }: GameProps) {
  return <SdvCivilisationBoard ctx={ctx} shuffler={randomShuffler} />
}
