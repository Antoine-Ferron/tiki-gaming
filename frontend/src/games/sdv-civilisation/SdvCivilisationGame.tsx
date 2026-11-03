import { useCallback, useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { Leaderboard } from '@/components/Leaderboard'
import type { GameContext, GameProps, LeaderboardEntry } from '../types'
import { randomShuffler, standardTrade } from './adapters'
import { chooseAction } from './ai'
import { fillWithBots } from './bots'
import { CardFace, PlayedCard } from './CardFace'
import { actionDetail, cardStatus, wonderAction } from './cardText'
import {
  createGame,
  payment,
  playTurn,
  shields,
  TURNS_PER_AGE,
  wonderPayment,
  type Action,
  type PlayerState,
} from './game'
import { FullscreenIcon, RulesIcon } from './icons'
import type { Shuffler } from './ports'
import { Results } from './Results'
import { RulesDialog } from './RulesDialog'
import { ranking } from './score'
import { neighbours } from './setup'
import { TurnLog, type TurnRecord } from './TurnLog'
import { WonderPanel } from './WonderPanel'
import './sdv-civilisation.css'

const AGES = ['I', 'II', 'III']
const ME = 0

/**
 * Point de l'ellipse où poser l'élément du joueur `index` : le joueur 0 en bas, les suivants dans le sens inverse
 * des aiguilles d'une montre, pour que le voisin de droite (index + 1) soit à droite à l'écran.
 * Rayons en % de la table : sièges sur le bord, cartes jouées sur le tapis.
 */
function around(index: number, count: number, radiusX: number, radiusY: number): CSSProperties {
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / count
  return { left: `${50 + radiusX * Math.cos(angle)}%`, top: `${50 - radiusY * Math.sin(angle)}%` }
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

/** Une des trois actions possibles avec la carte choisie : titre, explication, et bouton désactivé si impossible. */
function ActionChoice(props: { title: string; detail: string; enabled: boolean; onPlay: () => void }) {
  return (
    <button type="button" className="sdv-civilisation-action" disabled={!props.enabled} onClick={props.onPlay}>
      <span className="sdv-civilisation-action-title">{props.title}</span>
      <span className="sdv-civilisation-action-detail">{props.detail}</span>
    </button>
  )
}

/**
 * Partie contre deux IA. Le mélangeur est injectable : aléatoire en production, ordre fixe dans les tests.
 * Voir docs/games/sdv-civilisation/regles.md#version-contre-ia
 */
export function SdvCivilisationBoard({ ctx, shuffler }: { ctx: GameContext; shuffler: Shuffler }) {
  const me = ctx.player?.username ?? 'Toi'
  const newGame = () => createGame(fillWithBots([me]), shuffler)
  const [game, setGame] = useState(newGame)
  const [history, setHistory] = useState<TurnRecord[]>([])
  // Position de la carte choisie dans la main (une main peut contenir deux exemplaires de la même carte).
  const [selected, setSelected] = useState<number | null>(null)
  const [showRules, setShowRules] = useState(false)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const boardRef = useRef<HTMLDivElement>(null)
  const fullscreen = useFullscreen(boardRef)
  const closeRules = useCallback(() => setShowRules(false), [])

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

  const myself = game.players[ME]
  const hand = game.hands[ME]
  const costs = hand.map((card) => payment(game, ME, card, standardTrade))
  const selectedCard = selected === null ? undefined : hand[selected]
  const { left, right } = neighbours(game.players, ME)
  const wonderCost = wonderPayment(game, ME, standardTrade)

  function play(action: Action) {
    const actions = game.players.map((_, i) => (i === ME ? action : chooseAction(game, i, standardTrade)))
    const next = playTurn(game, actions, standardTrade, shuffler)
    setHistory([{ age: game.age, turn: game.turn, events: next.lastTurn, conflicts: next.conflicts }, ...history])
    setGame(next)
    setSelected(null)
  }

  function replay() {
    setGame(newGame())
    setHistory([])
    setError(null)
  }

  return (
    <div ref={boardRef} className="sdv-civilisation">
      <div className="sdv-civilisation-main">
        <div className="sdv-civilisation-toolbar">
          <p className="sdv-civilisation-status">
            Âge <strong>{AGES[game.age - 1]}</strong> · Tour <strong>{game.turn}</strong> / {TURNS_PER_AGE}
          </p>
          <p className="sdv-civilisation-direction">
            <span aria-hidden="true">{game.age === 2 ? '↺' : '↻'}</span> Passage à{' '}
            {game.age === 2 ? 'droite' : 'gauche'}
          </p>
          <p className="sdv-civilisation-banner" role="status">
            {game.over && 'Partie terminée : voici le score de chacun.'}
            {!game.over && selectedCard && (
              <>
                Que fais-tu de <strong>{selectedCard.name}</strong> ? Choisis une action.
              </>
            )}
            {!game.over && !selectedCard && (
              <>
                <strong>À toi de jouer :</strong> choisis une carte de ta main.
              </>
            )}
          </p>
          <div className="sdv-civilisation-tools">
            <button
              type="button"
              className="sdv-civilisation-icon-button"
              aria-label="Règles du jeu"
              title="Règles du jeu"
              onClick={() => setShowRules(true)}
            >
              <RulesIcon />
            </button>
            {fullscreen.supported && (
              <button
                type="button"
                className="sdv-civilisation-icon-button"
                aria-label={fullscreen.active ? 'Quitter le plein écran' : 'Plein écran'}
                title={fullscreen.active ? 'Quitter le plein écran' : 'Plein écran'}
                onClick={fullscreen.toggle}
              >
                <FullscreenIcon exit={fullscreen.active} />
              </button>
            )}
          </div>
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
          </div>

          <div className="sdv-civilisation-discard" title="Pile de défausse">
            <span className="sdv-civilisation-discard-stack" aria-hidden="true" />
            <span>Défausse · {game.discards.length}</span>
          </div>

          {/* Cartes jouées au dernier tour, posées devant chaque joueur ; la clé relance l'animation à chaque tour. */}
          {game.lastTurn.map((event) => (
            <PlayedCard
              key={`${game.age}-${game.turn}-${event.player}`}
              card={event.card}
              action={event.action}
              style={around(event.player, game.players.length, 22, 22)}
            />
          ))}

          <ul className="sdv-civilisation-seats" aria-label="Table de jeu">
            {game.players.map((seat, index) => {
              const neighbour = neighbours(game.players, index)
              const isMe = index === ME
              return (
                <li
                  key={seat.name}
                  className={`sdv-civilisation-seat${isMe ? ' sdv-civilisation-seat-me' : ''}`}
                  style={around(index, game.players.length, 41, 39)}
                  aria-label={seatLabel(seat, isMe, neighbour.left, neighbour.right)}
                >
                  <div className="sdv-civilisation-seat-head" aria-hidden="true">
                    <span className="sdv-civilisation-avatar">
                      {seat.isBot ? 'IA' : seat.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="sdv-civilisation-name">{isMe ? 'Toi' : seat.name}</span>
                    {!game.over && (
                      <span
                        className={`sdv-civilisation-turn-badge${isMe ? ' sdv-civilisation-turn-badge-me' : ''}`}
                        title={isMe ? 'À toi de jouer' : 'A choisi sa carte'}
                      >
                        {isMe ? 'À toi' : '✓'}
                      </span>
                    )}
                  </div>
                  <div className="sdv-civilisation-stats" aria-hidden="true">
                    <span title="Pièces">
                      <span className="sdv-civilisation-coin" />
                      {seat.coins}
                    </span>
                    <span title="Boucliers">⚔ {shields(seat)}</span>
                    <span title="Jetons militaires">★ {seat.military}</span>
                  </div>
                  <div className="sdv-civilisation-seat-wonder" aria-hidden="true" title={seat.wonder.name}>
                    {seat.wonder.stages.map((_, i) => (
                      <span key={i} className={i < seat.stagesBuilt ? 'sdv-civilisation-pip-built' : undefined} />
                    ))}
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
            <div className="sdv-civilisation-cards">
              {hand.map((card, i) => (
                <CardFace
                  key={`${i}-${card.name}`}
                  card={card}
                  status={cardStatus(costs[i])}
                  selected={i === selected}
                  offset={i - (hand.length - 1) / 2}
                  onSelect={() => setSelected(i)}
                />
              ))}
            </div>
            {!selectedCard && (
              <p className="sdv-civilisation-actions-hint">
                Clique sur une carte pour voir ce que tu peux en faire : la construire, bâtir ta merveille avec, ou la
                défausser.
              </p>
            )}
            {selectedCard && (
              <div className="sdv-civilisation-actions" role="group" aria-label="Actions possibles">
                <ActionChoice
                  title={`Construire ${selectedCard.name}`}
                  detail={actionDetail(costs[selected!], left.name, right.name)}
                  enabled={costs[selected!].ok}
                  onPlay={() => play({ type: 'build', card: selectedCard.name })}
                />
                <ActionChoice
                  {...wonderAction(myself, wonderCost, left.name, right.name)}
                  enabled={wonderCost.ok}
                  onPlay={() => play({ type: 'wonder', card: selectedCard.name })}
                />
                <ActionChoice
                  title="Défausser"
                  detail="+3 pièces ; la carte va sur la défausse."
                  enabled
                  onPlay={() => play({ type: 'discard', card: selectedCard.name })}
                />
              </div>
            )}
          </div>
        )}
        {error && <p className="error">{error}</p>}
      </div>

      <aside className="sdv-civilisation-side">
        <WonderPanel player={myself} />
        <TurnLog history={history} players={game.players} me={ME} />
        <section className="sdv-civilisation-ranking" aria-labelledby="sdv-civilisation-ranking-title">
          <h3 id="sdv-civilisation-ranking-title">Classement</h3>
          <Leaderboard entries={leaderboard} currentUserId={ctx.player?.id} />
        </section>
      </aside>

      {showRules && <RulesDialog onClose={closeRules} />}
    </div>
  )
}

export default function SdvCivilisationGame({ ctx }: GameProps) {
  return <SdvCivilisationBoard ctx={ctx} shuffler={randomShuffler} />
}
