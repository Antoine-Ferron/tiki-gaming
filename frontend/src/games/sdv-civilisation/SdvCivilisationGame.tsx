import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { Leaderboard } from '@/components/Leaderboard'
import type { GameContext, GameProps, LeaderboardEntry } from '../types'
import { randomShuffler, standardTrade } from './adapters'
import { chooseAction } from './ai'
import { fillWithBots } from './bots'
import { CardFace } from './CardFace'
import { actionDetail, cardStatus, wonderAction } from './cardText'
import { CityBoard } from './CityBoard'
import {
  createGame,
  payment,
  playTurn,
  shields,
  TURNS_PER_AGE,
  wonderPayment,
  type Action,
  type GameState,
} from './game'
import { FullscreenIcon, RulesIcon } from './icons'
import { NeighbourPanel } from './NeighbourPanel'
import type { Shuffler } from './ports'
import { Results } from './Results'
import { RulesDialog } from './RulesDialog'
import { ranking } from './score'
import { neighbours } from './setup'
import { TurnLog, type TurnRecord } from './TurnLog'
import { WonderPicker } from './WonderPicker'
import type { Wonder } from './wonders'
import './sdv-civilisation.css'

const AGES = ['I', 'II', 'III']
const ME = 0

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
 * Partie contre deux IA : choix de la merveille, puis 3 âges. Le mélangeur est injectable : aléatoire en
 * production, ordre fixe dans les tests. Voir docs/games/sdv-civilisation/regles.md#version-contre-ia
 */
export function SdvCivilisationBoard({ ctx, shuffler }: { ctx: GameContext; shuffler: Shuffler }) {
  const me = ctx.player?.username ?? 'Toi'
  // Pas de partie tant que le joueur n'a pas choisi sa merveille.
  const [game, setGame] = useState<GameState | null>(null)
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
    if (!game?.over) return
    const mine = ranking(game.players).find((row) => row.name === me)!
    ctx
      .submitScore(mine.score.total, { ...mine.score })
      .then(() => ctx.getLeaderboard(10))
      .then(setLeaderboard)
      .catch((e) => setError(e.message))
  }, [ctx, game, me])

  function start(wonder: Wonder) {
    setGame(createGame(fillWithBots([me]), shuffler, wonder))
    setHistory([])
    setError(null)
  }

  const hand = game ? game.hands[ME] : []
  const selectedCard = selected === null ? undefined : hand[selected]

  const toolbar = (
    <header className="sdv-civilisation-toolbar">
      {game && (
        <>
          <p className="sdv-civilisation-status">
            <span className="sdv-civilisation-age">Âge {AGES[game.age - 1]}</span> · Tour <strong>{game.turn}</strong> /{' '}
            {TURNS_PER_AGE}
          </p>
          <p className="sdv-civilisation-direction">
            Les mains passent <strong>{game.age === 2 ? 'vers la droite →' : '← vers la gauche'}</strong>
          </p>
        </>
      )}
      <p className="sdv-civilisation-banner" role="status">
        {!game && (
          <>
            <strong>Nouvelle partie :</strong> choisis ta merveille pour commencer.
          </>
        )}
        {game?.over && 'Partie terminée : voici le score de chacun.'}
        {game && !game.over && selectedCard && (
          <>
            Que fais-tu de <strong>{selectedCard.name}</strong> ? Choisis une action.
          </>
        )}
        {game && !game.over && !selectedCard && (
          <>
            <strong>À toi de jouer :</strong> choisis une carte de ta main. Les IA ont déjà choisi.
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
    </header>
  )

  const errorBox = error && <p className="error">{error}</p>

  const ranks = (
    <section className="sdv-civilisation-ranking" aria-labelledby="sdv-civilisation-ranking-title">
      <h3 id="sdv-civilisation-ranking-title">Classement</h3>
      <Leaderboard entries={leaderboard} currentUserId={ctx.player?.id} />
    </section>
  )

  if (!game) {
    return (
      <div ref={boardRef} className="sdv-civilisation">
        {toolbar}
        <div className="sdv-civilisation-start">
          <WonderPicker onPick={start} />
          {ranks}
        </div>
        {errorBox}
        {showRules && <RulesDialog onClose={closeRules} />}
      </div>
    )
  }

  const current = game
  const myself = current.players[ME]
  const { left, right } = neighbours(current.players, ME)
  const costs = hand.map((card) => payment(current, ME, card, standardTrade))
  const wonderCost = wonderPayment(current, ME, standardTrade)
  const lastCoins = current.lastTurn.find((event) => event.player === ME)?.coins ?? 0

  function play(action: Action) {
    const actions = current.players.map((_, i) => (i === ME ? action : chooseAction(current, i, standardTrade)))
    const next = playTurn(current, actions, standardTrade, shuffler)
    setHistory([{ age: current.age, turn: current.turn, events: next.lastTurn, conflicts: next.conflicts }, ...history])
    setGame(next)
    setSelected(null)
  }

  return (
    <div ref={boardRef} className="sdv-civilisation">
      {toolbar}

      <div className="sdv-civilisation-tablerow">
        <NeighbourPanel player={left} side="left" myShields={shields(myself)} ready={!current.over} />

        <div className="sdv-civilisation-center" aria-label="Centre de la table">
          <div className="sdv-civilisation-felt">
            <span className="sdv-civilisation-felt-age">Âge {AGES[current.age - 1]}</span>
            <div className="sdv-civilisation-decks" aria-label={`Paquets d’âge, âge ${AGES[current.age - 1]} en cours`}>
              {AGES.map((age, index) => (
                <span
                  key={age}
                  className={`sdv-civilisation-deck${index === current.age - 1 ? ' sdv-civilisation-deck-current' : ''}`}
                >
                  {age}
                </span>
              ))}
              <span className="sdv-civilisation-discard">
                <span className="sdv-civilisation-deck sdv-civilisation-deck-back" aria-hidden="true" />
                Défausse · {current.discards.length}
              </span>
            </div>
            {!current.over && (
              <ul className="sdv-civilisation-slots" aria-label="Cartes du tour">
                <li>
                  <span className="sdv-civilisation-slot-back" aria-hidden="true" />
                  {left.name} · cachée
                </li>
                <li>
                  <span className="sdv-civilisation-slot-mine" aria-hidden="true">
                    {selectedCard?.name}
                  </span>
                  Toi · {selectedCard ? 'choisie' : 'à choisir'}
                </li>
                <li>
                  <span className="sdv-civilisation-slot-back" aria-hidden="true" />
                  {right.name} · cachée
                </li>
              </ul>
            )}
          </div>
        </div>

        <NeighbourPanel player={right} side="right" myShields={shields(myself)} ready={!current.over} />
      </div>

      <CityBoard player={myself} left={left} right={right} lastCoins={lastCoins} />

      <div className="sdv-civilisation-play">
        {current.over ? (
          <div className="sdv-civilisation-end">
            <Results ranked={ranking(current.players)} me={me} isGuest={ctx.isGuest} onReplay={() => setGame(null)} />
            {ranks}
          </div>
        ) : (
          <>
            <div className="sdv-civilisation-hand">
              <p className="sdv-civilisation-muted">
                Ta main · {hand.length} cartes de l’âge {AGES[current.age - 1]}
              </p>
              <div className="sdv-civilisation-cards">
                {hand.map((card, i) => (
                  <CardFace
                    key={`${i}-${card.name}`}
                    card={card}
                    status={cardStatus(costs[i])}
                    selected={i === selected}
                    onSelect={() => setSelected(i)}
                  />
                ))}
              </div>
            </div>
            <div className="sdv-civilisation-actions" role="group" aria-label="Actions possibles">
              {!selectedCard && (
                <p className="sdv-civilisation-muted">
                  Clique sur une carte pour voir ce que tu peux en faire : la construire, bâtir ta merveille avec, ou la
                  défausser.
                </p>
              )}
              {selectedCard && (
                <>
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
                    detail={`+3 pièces → ${myself.coins + 3} pièces ; la carte va sur la défausse.`}
                    enabled
                    onPlay={() => play({ type: 'discard', card: selectedCard.name })}
                  />
                </>
              )}
            </div>
          </>
        )}
        <TurnLog history={history} players={current.players} me={ME} />
      </div>

      {errorBox}
      {showRules && <RulesDialog onClose={closeRules} />}
    </div>
  )
}

export default function SdvCivilisationGame({ ctx }: GameProps) {
  return <SdvCivilisationBoard ctx={ctx} shuffler={randomShuffler} />
}
