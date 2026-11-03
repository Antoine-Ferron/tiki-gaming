import { useCallback, useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { Leaderboard } from '@/components/Leaderboard'
import type { GameContext, GameProps, LeaderboardEntry } from '../types'
import { randomShuffler, standardTrade } from './adapters'
import { chooseAction } from './ai'
import {
  APPLY_STEP,
  DURATIONS,
  readTempo,
  saveTempo,
  TEMPO_FACTOR,
  TEMPOS,
  turnSteps,
  type Step,
  type Tempo,
} from './animation'
import { fillWithBots } from './bots'
import { CardDetail } from './CardDetail'
import { CardFace } from './CardFace'
import { cardStatus, duel, relevantNeeds } from './cardText'
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
  type ResourceNeed,
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

/** Où part la carte jouée par le joueur : vers ses bâtiments, l'étape de merveille à bâtir ou la défausse. */
const TARGETS: Record<Action['type'], string> = {
  build: '.sdv-civilisation-citycards',
  wonder: '.sdv-civilisation-stage-next',
  discard: '.sdv-civilisation-discard',
}

/**
 * Tour en cours d'animation. Le moteur a déjà joué le tour (`game` est à jour) ; tant que l'étape « apply » n'est
 * pas atteinte, l'écran montre encore `before` pour laisser au joueur le temps de voir ce qui se passe.
 */
interface Sequence {
  before: GameState
  steps: Step[]
  index: number
  /** Carte jouée par le joueur : sa position dans la main et le trajet jusqu'à sa destination. */
  played: { index: number; dx: number; dy: number }
  /** Ressources de l'action jouée, pour garder en évidence ce qui a été produit ou acheté. */
  needs: ResourceNeed[]
  /** Pièces payées à chaque voisin pour commercer. */
  paid: { left: number; right: number }
}

const passing = (age: number) => (age === 2 ? 'vers la droite →' : '← vers la gauche')

function center(el: Element) {
  const rect = el.getBoundingClientRect()
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
}

/** Message de la barre d'état pour chaque étape du tour. */
function stepText(step: Step, before: GameState): string {
  if (step === 'reveal') return 'Tous les joueurs ont choisi : les cartes sont révélées.'
  if (step === 'pass') {
    if (before.turn === TURNS_PER_AGE) return 'Fin de l’âge : la dernière carte de chaque main part à la défausse.'
    return `Les mains passent ${passing(before.age)}.`
  }
  if (step === 'apply') return 'Les civilisations se mettent à jour.'
  if (step === 'age') return 'Changement d’âge.'
  return 'Conflits militaires : un duel contre chaque voisin.'
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

type Panel = 'rules' | 'journal' | 'left' | 'right' | null

/**
 * Partie contre deux IA, organisée en trois zones : les voisins (B), la civilisation du joueur (A) et sa main (C).
 * Les informations avancées (journal, cité d'un voisin, règles) s'ouvrent dans une fenêtre.
 * Chaque tour est raconté par une courte séquence animée (révélation, passage des mains, conflits), au tempo
 * choisi par le joueur. Le mélangeur est injectable : aléatoire en production, ordre fixe dans les tests.
 */
export function SdvCivilisationBoard(props: { ctx: GameContext; shuffler: Shuffler; tempo?: Tempo }) {
  const { ctx, shuffler } = props
  const me = ctx.player?.username ?? 'Toi'
  // Pas de partie tant que le joueur n'a pas choisi sa merveille.
  const [game, setGame] = useState<GameState | null>(null)
  const [history, setHistory] = useState<TurnRecord[]>([])
  // Position de la carte choisie dans la main (une main peut contenir deux exemplaires de la même carte).
  const [selected, setSelected] = useState<number | null>(null)
  const [panel, setPanel] = useState<Panel>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [tempo, setTempo] = useState<Tempo>(() => props.tempo ?? readTempo())
  const [sequence, setSequence] = useState<Sequence | null>(null)
  const boardRef = useRef<HTMLDivElement>(null)
  const cardsRef = useRef<HTMLDivElement>(null)
  const fullscreen = useFullscreen(boardRef)
  const closePanel = useCallback(() => setPanel(null), [])
  const scrollOnStart = useRef(false)
  const factor = TEMPO_FACTOR[tempo]

  // Le plateau occupe tout l'écran pendant la partie : au lancement, la page défile jusqu'à lui (une fois affiché).
  useEffect(() => {
    if (!scrollOnStart.current) return
    scrollOnStart.current = false
    boardRef.current?.scrollIntoView?.({ block: 'start' })
  }, [game])

  // Une étape du tour après l'autre ; la dernière terminée, la nouvelle main arrive.
  useEffect(() => {
    if (!sequence) return
    const id = setTimeout(
      () => setSequence((s) => s && (s.index + 1 < s.steps.length ? { ...s, index: s.index + 1 } : null)),
      DURATIONS[sequence.steps[sequence.index]] * factor,
    )
    return () => clearTimeout(id)
  }, [sequence, factor])

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

  function changeTempo(value: Tempo) {
    setTempo(value)
    saveTempo(value)
    if (value === 'off') setSequence(null)
  }

  const step = sequence?.steps[sequence.index]
  const beforeApply = sequence !== null && sequence.index < APPLY_STEP
  // Ce que voit le joueur : l'état de début de tour pendant la révélation, puis le nouvel état.
  const view = beforeApply ? sequence.before : game
  const hand = view ? view.hands[ME] : []
  const selectedCard = selected === null ? undefined : hand[selected]
  // Le tour affiché ne change qu'à l'arrivée de la nouvelle main, une fois la séquence terminée.
  const shownTurn = sequence?.before ?? view
  const errorBox = error && <p className="error">{error}</p>

  const toolbar = (
    <header className="sdv-civilisation-toolbar">
      {shownTurn && (
        <p className="sdv-civilisation-status">
          <span className="sdv-civilisation-age">Âge {AGES[shownTurn.age - 1]}</span> · Tour{' '}
          <strong>{shownTurn.turn}</strong> / {TURNS_PER_AGE}
          <span className="sdv-civilisation-direction">
            Les mains passent <strong>{passing(shownTurn.age)}</strong>
          </span>
        </p>
      )}
      <p className="sdv-civilisation-banner" role="status">
        {!game && (
          <>
            <strong>Nouvelle partie :</strong> choisis ta merveille pour commencer.
          </>
        )}
        {sequence && step && <span key={step}>{stepText(step, sequence.before)}</span>}
        {!sequence && game?.over && 'Partie terminée : voici le score de chacun.'}
        {!sequence && game && !game.over && selectedCard && (
          <>
            <strong>{selectedCard.name}</strong> : choisis une action à droite de ta main.
          </>
        )}
        {!sequence && game && !game.over && !selectedCard && (
          <>
            <strong>À toi de jouer :</strong> choisis une carte de ta main.
          </>
        )}
      </p>
      <div className="sdv-civilisation-tools">
        <label className="sdv-civilisation-tempo">
          Animations
          <select value={tempo} onChange={(e) => changeTempo(e.target.value as Tempo)}>
            {TEMPOS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
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

  if (!game || !view) {
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

  const current = view
  const after = game
  const myself = current.players[ME]
  const { left, right } = neighbours(current.players, ME)
  const count = current.players.length
  const seat = { left: (ME - 1 + count) % count, right: (ME + 1) % count }
  const costs = hand.map((card) => payment(current, ME, card, standardTrade))
  const buildCost = selected === null ? undefined : costs[selected]
  const buildNeeds =
    selectedCard && buildCost ? relevantNeeds(buildCost, costBreakdown(current, ME, selectedCard.cost)) : []
  const wonderCost = wonderPayment(current, ME, standardTrade)
  const stageNeeds = wonderNeeds(current, ME)
  const coinsOf = (player: number) => current.lastTurn.find((event) => event.player === player)?.coins ?? 0
  // Identifiant du tour affiché : les animations liées au tour (gains, arrivée de la main) se rejouent à chaque tour.
  const stamp = `${current.age}-${current.turn}`
  const shownNeeds = sequence ? (beforeApply ? sequence.needs : []) : buildNeeds
  const bought = (side: 'fromLeft' | 'fromRight') => shownNeeds.filter((n) => n[side] > 0).map((n) => n.resource)
  // Pendant la révélation, chaque voisin montre la carte qu'il vient de jouer.
  const reveal = (side: 'left' | 'right') =>
    beforeApply ? { event: after.lastTurn[seat[side]], paid: sequence.paid[side] } : undefined
  // La nouvelle main vient du voisin qui passe la sienne, ou du paquet de l'âge au premier tour.
  const from = current.turn === 1 ? 'deck' : current.age === 2 ? 'left' : 'right'
  const arrival =
    from === 'deck'
      ? `Nouvelles cartes de l’âge ${AGES[current.age - 1]}`
      : `Main reçue de ${from === 'left' ? left.name : right.name}`
  const shown = panel === 'left' ? left : right
  const duels = after.players[ME].tokens.slice(-2)
  const shieldsOf = (name: string) => shields(after.players.find((p) => p.name === name)!)

  function play(type: Action['type']) {
    const index = selected!
    const action = { type, card: selectedCard!.name }
    const actions = current.players.map((_, i) => (i === ME ? action : chooseAction(current, i, standardTrade)))
    const next = playTurn(current, actions, standardTrade, shuffler)
    setHistory([{ age: current.age, turn: current.turn, events: next.lastTurn, conflicts: next.conflicts }, ...history])
    setGame(next)
    setSelected(null)
    if (factor === 0) return

    // La carte part de la main vers sa destination : le trajet est mesuré avant que l'écran change.
    const startAt = center(cardsRef.current!.children[index])
    const endAt = center(boardRef.current!.querySelector(TARGETS[type])!)
    const cost = type === 'build' ? buildCost! : type === 'wonder' ? wonderCost : null
    setSequence({
      before: current,
      steps: turnSteps(next),
      index: 0,
      played: { index, dx: endAt.x - startAt.x, dy: endAt.y - startAt.y },
      needs: type === 'build' ? buildNeeds : type === 'wonder' ? stageNeeds : [],
      paid: cost?.ok ? { left: cost.toLeft, right: cost.toRight } : { left: 0, right: 0 },
    })
  }

  // Animation de chaque carte de la main : arrivée d'une nouvelle main, envol de la carte jouée, départ des autres.
  function motion(i: number): { motion?: string; style: CSSProperties } {
    const style = { '--i': i } as CSSProperties
    if (!sequence) return { motion: 'sdv-civilisation-card-arrive', style }
    if (i === sequence.played.index) {
      const trip = { '--dx': `${sequence.played.dx}px`, '--dy': `${sequence.played.dy}px` }
      return { motion: 'sdv-civilisation-card-fly', style: { ...style, ...trip } as CSSProperties }
    }
    return { motion: step === 'pass' ? 'sdv-civilisation-card-leave' : undefined, style }
  }

  return (
    <div
      ref={boardRef}
      className="sdv-civilisation sdv-civilisation-playing"
      data-tempo={tempo}
      style={{ '--sdv-civilisation-tempo': factor } as CSSProperties}
    >
      {toolbar}

      <div className="sdv-civilisation-neighbours">
        <NeighbourPanel
          player={left}
          side="left"
          myShields={shields(myself)}
          ready={!current.over}
          bought={bought('fromLeft')}
          onOpen={() => setPanel('left')}
          delta={coinsOf(seat.left)}
          stamp={stamp}
          reveal={reveal('left')}
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
            <span key={current.discards.length} className="sdv-civilisation-discard sdv-civilisation-pop">
              Défausse · {current.discards.length}
            </span>
          </div>
          {current.lastTurn.length > 0 && (
            <ul className="sdv-civilisation-revealed" aria-label="Cartes jouées au dernier tour">
              {current.lastTurn.map((event) => (
                <li key={`${stamp}-${event.player}`} style={{ '--i': event.player } as CSSProperties}>
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
          delta={coinsOf(seat.right)}
          stamp={stamp}
          reveal={reveal('right')}
        />
      </div>

      <CityBoard player={myself} left={left} right={right} lastCoins={coinsOf(ME)} stamp={stamp} needs={shownNeeds} />

      {(step === 'duel-left' || step === 'duel-right') && (
        <div className="sdv-civilisation-stage" aria-label="Conflits militaires">
          <span className="sdv-civilisation-stage-kicker">
            Conflits militaires · Âge {AGES[sequence!.before.age - 1]}
          </span>
          <ul>
            {duels.slice(0, step === 'duel-left' ? 1 : 2).map((token) => {
              const result = duel(token.value, 0)
              return (
                <li key={token.against} className={`sdv-civilisation-duel-${result.kind}`}>
                  Contre {token.against} : {shields(after.players[ME])} contre {shieldsOf(token.against)} —{' '}
                  <strong>
                    {result.label}
                    {token.value !== 0 && ` ${token.value.toLocaleString('fr-FR', { signDisplay: 'always' })}`}
                  </strong>
                </li>
              )
            })}
          </ul>
        </div>
      )}
      {step === 'age' && (
        <div className="sdv-civilisation-stage sdv-civilisation-stage-age" aria-label="Changement d’âge">
          <span className="sdv-civilisation-stage-kicker">Fin de l’âge {AGES[sequence!.before.age - 1]}</span>
          <strong>{after.over ? 'Fin de la partie' : `Âge ${AGES[after.age - 1]}`}</strong>
        </div>
      )}

      {current.over && !sequence ? (
        <div className="sdv-civilisation-end">
          <Results ranked={ranking(current.players)} me={me} isGuest={ctx.isGuest} onReplay={() => setGame(null)} />
          {ranks}
        </div>
      ) : (
        <section className="sdv-civilisation-handzone" aria-labelledby="sdv-civilisation-hand-title">
          <div className="sdv-civilisation-hand">
            <h2 id="sdv-civilisation-hand-title" className="sdv-civilisation-zone-title">
              Ta main · {hand.length} cartes à jouer
              {!sequence && (
                <span key={stamp} className="sdv-civilisation-arrival">
                  {arrival}
                </span>
              )}
            </h2>
            {sequence && !beforeApply ? (
              <p
                className={`sdv-civilisation-passing sdv-civilisation-passing-${sequence.before.age === 2 ? 'right' : 'left'}`}
              >
                {sequence.before.turn === TURNS_PER_AGE
                  ? 'Les dernières cartes partent à la défausse.'
                  : `Les mains passent ${passing(sequence.before.age)}`}
              </p>
            ) : (
              <div
                ref={cardsRef}
                className={`sdv-civilisation-cards sdv-civilisation-from-${from} sdv-civilisation-pass-${current.age === 2 ? 'right' : 'left'}`}
                style={{ '--hand': hand.length } as CSSProperties}
              >
                {hand.map((card, i) => (
                  <CardFace
                    key={`${stamp}-${i}`}
                    card={card}
                    status={cardStatus(costs[i])}
                    selected={i === selected}
                    onSelect={() => setSelected(i)}
                    disabled={sequence !== null}
                    {...motion(i)}
                  />
                ))}
              </div>
            )}
          </div>
          {sequence ? (
            <div className="sdv-civilisation-detail sdv-civilisation-detail-empty">
              <p>Résolution du tour : regarde ce que chacun a joué.</p>
              <button type="button" className="sdv-civilisation-secondary" onClick={() => setSequence(null)}>
                Passer l’animation
              </button>
            </div>
          ) : selectedCard && buildCost ? (
            <CardDetail
              key={selected}
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
          <TurnLog history={history} players={after.players} me={ME} />
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
