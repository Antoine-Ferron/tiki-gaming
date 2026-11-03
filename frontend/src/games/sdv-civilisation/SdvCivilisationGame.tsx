import { useCallback, useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { Leaderboard } from '@/components/Leaderboard'
import type { GameContext, GameProps, LeaderboardEntry } from '../types'
import { randomShuffler, standardTrade } from './adapters'
import { chooseAction } from './ai'
import { fillWithBots } from './bots'
import { CardDetail } from './CardDetail'
import { CardFace } from './CardFace'
import { cardStatus, relevantNeeds } from './cardText'
import { CityBoard, CityCards, WonderBoard } from './CityBoard'
import {
  costBreakdown,
  createGame,
  payment,
  playTurn,
  shields,
  TURNS_PER_AGE,
  wonderNeeds,
  wonderPayment,
  type Action,
  type GameState,
  type TurnEvent,
} from './game'
import { FullscreenIcon, RulesIcon } from './icons'
import { Modal } from './Modal'
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
const PLAYED: Record<TurnEvent['action'], string> = { build: '', wonder: 'étape de merveille', discard: 'défausse' }

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

type Panel = 'rules' | 'journal' | 'left' | 'right' | null

/**
 * Partie contre deux IA, organisée en trois zones : les voisins (B), la civilisation du joueur (A) et sa main (C).
 * Les informations avancées (journal, cité d'un voisin, règles) s'ouvrent dans une fenêtre.
 * Le mélangeur est injectable : aléatoire en production, ordre fixe dans les tests.
 */
export function SdvCivilisationBoard({ ctx, shuffler }: { ctx: GameContext; shuffler: Shuffler }) {
  const me = ctx.player?.username ?? 'Toi'
  // Pas de partie tant que le joueur n'a pas choisi sa merveille.
  const [game, setGame] = useState<GameState | null>(null)
  const [history, setHistory] = useState<TurnRecord[]>([])
  // Position de la carte choisie dans la main (une main peut contenir deux exemplaires de la même carte).
  const [selected, setSelected] = useState<number | null>(null)
  const [panel, setPanel] = useState<Panel>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const boardRef = useRef<HTMLDivElement>(null)
  const fullscreen = useFullscreen(boardRef)
  const closePanel = useCallback(() => setPanel(null), [])
  const scrollOnStart = useRef(false)

  // Le plateau occupe tout l'écran pendant la partie : au lancement, la page défile jusqu'à lui (une fois affiché).
  useEffect(() => {
    if (!scrollOnStart.current) return
    scrollOnStart.current = false
    boardRef.current?.scrollIntoView?.({ block: 'start' })
  }, [game])

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
    scrollOnStart.current = true
    setHistory([])
    setError(null)
  }

  const hand = game ? game.hands[ME] : []
  const selectedCard = selected === null ? undefined : hand[selected]
  const errorBox = error && <p className="error">{error}</p>

  const toolbar = (
    <header className="sdv-civilisation-toolbar">
      {game && (
        <p className="sdv-civilisation-status">
          <span className="sdv-civilisation-age">Âge {AGES[game.age - 1]}</span> · Tour <strong>{game.turn}</strong> /{' '}
          {TURNS_PER_AGE}
          <span className="sdv-civilisation-direction">
            Les mains passent <strong>{game.age === 2 ? 'vers la droite →' : '← vers la gauche'}</strong>
          </span>
        </p>
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
            <strong>{selectedCard.name}</strong> : choisis une action à droite de ta main.
          </>
        )}
        {game && !game.over && !selectedCard && (
          <>
            <strong>À toi de jouer :</strong> choisis une carte de ta main.
          </>
        )}
      </p>
      <div className="sdv-civilisation-tools">
        {game && (
          <button type="button" className="sdv-civilisation-secondary" onClick={() => setPanel('journal')}>
            Journal
          </button>
        )}
        <button type="button" className="sdv-civilisation-secondary" onClick={() => setPanel('rules')}>
          <RulesIcon /> Règles
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
        {panel === 'rules' && <RulesDialog onClose={closePanel} />}
      </div>
    )
  }

  const current = game
  const myself = current.players[ME]
  const { left, right } = neighbours(current.players, ME)
  const costs = hand.map((card) => payment(current, ME, card, standardTrade))
  const buildCost = selected === null ? undefined : costs[selected]
  const buildNeeds =
    selectedCard && buildCost ? relevantNeeds(buildCost, costBreakdown(current, ME, selectedCard.cost)) : []
  const wonderCost = wonderPayment(current, ME, standardTrade)
  const stageNeeds = wonderNeeds(current, ME)
  const lastCoins = current.lastTurn.find((event) => event.player === ME)?.coins ?? 0
  const bought = (side: 'fromLeft' | 'fromRight') => buildNeeds.filter((n) => n[side] > 0).map((n) => n.resource)
  const shown = panel === 'left' ? left : right

  function play(type: Action['type']) {
    const action = { type, card: selectedCard!.name }
    const actions = current.players.map((_, i) => (i === ME ? action : chooseAction(current, i, standardTrade)))
    const next = playTurn(current, actions, standardTrade, shuffler)
    setHistory([{ age: current.age, turn: current.turn, events: next.lastTurn, conflicts: next.conflicts }, ...history])
    setGame(next)
    setSelected(null)
  }

  return (
    <div ref={boardRef} className="sdv-civilisation sdv-civilisation-playing">
      {toolbar}

      <div className="sdv-civilisation-neighbours">
        <NeighbourPanel
          player={left}
          side="left"
          myShields={shields(myself)}
          ready={!current.over}
          bought={bought('fromLeft')}
          onOpen={() => setPanel('left')}
        />

        <div className="sdv-civilisation-center" aria-label="Centre de la table">
          <div className="sdv-civilisation-decks" aria-label={`Paquets d’âge, âge ${AGES[current.age - 1]} en cours`}>
            {AGES.map((age, index) => (
              <span
                key={age}
                className={`sdv-civilisation-deck${index === current.age - 1 ? ' sdv-civilisation-deck-current' : ''}`}
              >
                {age}
              </span>
            ))}
            <span className="sdv-civilisation-discard">Défausse · {current.discards.length}</span>
          </div>
          {current.lastTurn.length > 0 && (
            <ul className="sdv-civilisation-revealed" aria-label="Cartes jouées au dernier tour">
              {current.lastTurn.map((event) => (
                <li key={event.player}>
                  <span className="sdv-civilisation-muted">
                    {event.player === ME ? 'Toi' : current.players[event.player].name}
                  </span>
                  <strong>{PLAYED[event.action] || event.card.name}</strong>
                </li>
              ))}
            </ul>
          )}
        </div>

        <NeighbourPanel
          player={right}
          side="right"
          myShields={shields(myself)}
          ready={!current.over}
          bought={bought('fromRight')}
          onOpen={() => setPanel('right')}
        />
      </div>

      <CityBoard player={myself} left={left} right={right} lastCoins={lastCoins} needs={buildNeeds} />

      {current.over ? (
        <div className="sdv-civilisation-end">
          <Results ranked={ranking(current.players)} me={me} isGuest={ctx.isGuest} onReplay={() => setGame(null)} />
          {ranks}
        </div>
      ) : (
        <section className="sdv-civilisation-handzone" aria-labelledby="sdv-civilisation-hand-title">
          <div className="sdv-civilisation-hand">
            <h2 id="sdv-civilisation-hand-title" className="sdv-civilisation-zone-title">
              Ta main · {hand.length} cartes à jouer
            </h2>
            <div className="sdv-civilisation-cards" style={{ '--hand': hand.length } as CSSProperties}>
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
          {selectedCard && buildCost ? (
            <CardDetail
              card={selectedCard}
              player={myself}
              left={left.name}
              right={right.name}
              build={{ cost: buildCost, needs: buildNeeds }}
              wonder={{ cost: wonderCost, needs: stageNeeds }}
              onPlay={play}
            />
          ) : (
            <p className="sdv-civilisation-detail sdv-civilisation-detail-empty">
              Choisis une carte : tu verras ici ce qu’elle coûte et les trois actions possibles — la construire, bâtir
              ta merveille avec, ou la défausser contre 3 pièces.
            </p>
          )}
        </section>
      )}

      {errorBox}
      {panel === 'rules' && <RulesDialog onClose={closePanel} />}
      {panel === 'journal' && (
        <Modal title="Journal de la partie" onClose={closePanel}>
          <TurnLog history={history} players={current.players} me={ME} />
        </Modal>
      )}
      {(panel === 'left' || panel === 'right') && (
        <Modal title={`Cité de ${shown.name}`} onClose={closePanel}>
          <WonderBoard player={shown} />
          <CityCards player={shown} label={`Bâtiments de ${shown.name}`} />
        </Modal>
      )}
    </div>
  )
}

export default function SdvCivilisationGame({ ctx }: GameProps) {
  return <SdvCivilisationBoard ctx={ctx} shuffler={randomShuffler} />
}
