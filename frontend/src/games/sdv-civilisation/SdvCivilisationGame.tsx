import { useCallback, useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { Leaderboard } from '@/components/Leaderboard'
import type { GameContext, GameProps, LeaderboardEntry } from '../types'
import { httpGameServer } from './adapters'
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
import { CardDetail } from './CardDetail'
import { CardFace } from './CardFace'
import { cardStatus, duel } from './cardText'
import { CityBoard, CityCards, WonderBoard } from './CityBoard'
import {
  neighbours,
  TURNS_PER_AGE,
  type ActionType,
  type GameView,
  type Payment,
  type ResourceNeed,
  type TurnEvent,
} from './game'
import { FullscreenIcon, RulesIcon } from './icons'
import { Modal } from './Modal'
import { NeighbourPanel } from './NeighbourPanel'
import { TurnConflict, type GameServer } from './ports'
import { Results } from './Results'
import { RulesDialog } from './RulesDialog'
import { TurnLog, type TurnRecord } from './TurnLog'
import { TurnTimer } from './TurnTimer'
import { WonderPicker } from './WonderPicker'
import type { Wonder } from './wonders'
import './sdv-civilisation.css'

const AGES = ['I', 'II', 'III']
/** Le serveur assoit le joueur à la première place et l'appelle « Toi ». */
const ME = 0
const ME_NAME = 'Toi'
const EXPIRED = 'Temps écoulé : une carte de ta main a été défaussée au hasard.'
const PLAYED: Record<TurnEvent['action'], string> = { build: '', wonder: 'étape de merveille', discard: 'défausse' }

/** Où part la carte jouée par le joueur : vers ses bâtiments, l'étape de merveille à bâtir ou la défausse. */
const TARGETS: Record<ActionType, string> = {
  build: '.sdv-civilisation-citycards',
  wonder: '.sdv-civilisation-stage-next',
  discard: '.sdv-civilisation-discard',
}

/** Coup joué par le joueur : la carte, son trajet à l'écran, et ce que l'action coûte (calculé par le serveur). */
interface Move {
  index: number
  dx: number
  dy: number
  cost?: Payment
  needs: ResourceNeed[]
}

/**
 * Tour en cours d'animation. Le serveur a déjà joué le tour (`game` est à jour) ; tant que l'étape « apply »
 * n'est pas atteinte, l'écran montre encore `before` pour laisser au joueur le temps de voir ce qui se passe.
 */
interface Sequence {
  before: GameView
  steps: Step[]
  index: number
  /** Coup du joueur, ou null si le serveur a joué à sa place (minuteur expiré, autre onglet). */
  played: Move | null
  /** Pièces payées à chaque voisin pour commercer. */
  paid: { left: number; right: number }
}

const passing = (passesLeft: boolean) => (passesLeft ? '← vers la gauche' : 'vers la droite →')

// Erreurs du serveur (ApiError, TurnConflict) et du classement (GameError) : toutes portent un message pour le joueur.
const errorText = (err: unknown) => (err as Error).message

function center(el: Element) {
  const rect = el.getBoundingClientRect()
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
}

/** Message de la barre d'état pour chaque étape du tour. */
function stepText(step: Step, before: GameView): string {
  if (step === 'reveal') return 'Tous les joueurs ont choisi : les cartes sont révélées.'
  if (step === 'pass') {
    if (before.turn === TURNS_PER_AGE) return 'Fin de l’âge : la dernière carte de chaque main part à la défausse.'
    return `Les mains passent ${passing(before.passesLeft)}.`
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
 * Partie contre deux IA, arbitrée par le serveur et organisée en trois zones : les voisins (B), la civilisation
 * du joueur (A) et sa main (C). Le serveur garde la partie (le joueur la reprend en revenant), calcule le prix de
 * chaque carte, fait jouer les IA, tient le minuteur et enregistre le score. Chaque tour est raconté par une
 * courte séquence animée, au tempo choisi par le joueur. Le serveur est injectable : HTTP en production, fake
 * dans les tests.
 */
export function SdvCivilisationBoard(props: { ctx: GameContext; server: GameServer; tempo?: Tempo }) {
  const { ctx, server } = props
  const [wonders, setWonders] = useState<Wonder[]>([])
  // Pas de partie tant que le joueur n'a pas choisi sa merveille (ou repris la sienne).
  const [game, setGame] = useState<GameView | null>(null)
  // Chaque réponse du serveur relance le minuteur du tour, même quand la partie n'a pas changé de version.
  const [received, setReceived] = useState(0)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
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
  const over = game?.over ?? false

  // Au chargement : les merveilles à choisir, et la partie à reprendre s'il y en a une.
  useEffect(() => {
    server
      .wonders()
      .then(setWonders)
      .catch((err) => setError(errorText(err)))
    server
      .current()
      .then((saved) => {
        if (!saved) return
        setGame(saved)
        setReceived((n) => n + 1)
        setNotice(`Partie reprise : âge ${AGES[saved.age - 1]}, tour ${saved.turn}.`)
      })
      .catch((err) => setError(errorText(err)))
  }, [server])

  // Classement de la plateforme, relu en fin de partie : le serveur vient d'y enregistrer le score du joueur.
  useEffect(() => {
    ctx
      .getLeaderboard(10)
      .then(setLeaderboard)
      .catch((err) => setError(errorText(err)))
  }, [ctx, over])

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

  /** Retour au choix de la merveille, sans rien garder de la partie précédente. */
  function reset() {
    setGame(null)
    setSequence(null)
    setHistory([])
    setSelected(null)
    setNotice(null)
    setError(null)
  }

  /**
   * Nouvelle vue renvoyée par le serveur. Si un tour a été joué (nouvelle version), il est gardé au journal et
   * raconté par la séquence animée.
   */
  function receive(before: GameView, next: GameView, move: Move | null = null) {
    setGame(next)
    setReceived((n) => n + 1)
    setSelected(null)
    if (next.version === before.version) return
    setHistory((h) => [
      { age: before.age, turn: before.turn, events: next.lastTurn, conflicts: next.conflicts ?? null },
      ...h,
    ])
    if (factor === 0) return
    const cost = move?.cost
    setSequence({
      before,
      steps: turnSteps(next),
      index: 0,
      played: move,
      paid: cost?.ok ? { left: cost.toLeft, right: cost.toRight } : { left: 0, right: 0 },
    })
  }

  async function start(wonder: Wonder) {
    try {
      const view = await server.start(wonder.name)
      reset()
      setGame(view)
      setReceived((n) => n + 1)
      scrollOnStart.current = true
    } catch (err) {
      setError(errorText(err))
    }
  }

  async function abandon() {
    try {
      await server.abandon()
      reset()
    } catch (err) {
      setError(errorText(err))
    }
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
  const hand = view?.hand ?? []
  const selectedCard = selected === null ? undefined : hand[selected]
  // Le tour affiché ne change qu'à l'arrivée de la nouvelle main, une fois la séquence terminée.
  const shownTurn = sequence?.before ?? view
  const errorBox = error && <p className="error">{error}</p>

  /**
   * Le minuteur est écoulé : le serveur a défaussé une carte au hasard (ou le fera dans un instant). Si la partie
   * n'existe plus (abandonnée depuis un autre onglet), retour au choix de la merveille.
   */
  async function expire(playing: GameView) {
    try {
      const next = await server.current()
      if (!next) return reset()
      receive(playing, next)
      if (next.version !== playing.version) setNotice(EXPIRED)
    } catch (err) {
      setError(errorText(err))
    }
  }

  const prompt = notice ?? (
    <>
      <strong>À toi de jouer :</strong> choisis une carte de ta main.
    </>
  )

  const toolbar = (
    <header className="sdv-civilisation-toolbar">
      {shownTurn && (
        <p className="sdv-civilisation-status">
          <span className="sdv-civilisation-age">Âge {AGES[shownTurn.age - 1]}</span> · Tour{' '}
          <strong>{shownTurn.turn}</strong> / {TURNS_PER_AGE}
          <span className="sdv-civilisation-direction">
            Les mains passent <strong>{passing(shownTurn.passesLeft)}</strong>
          </span>
        </p>
      )}
      {game && !game.over && (
        <TurnTimer key={received} remainingMs={game.remainingMs} onExpire={() => void expire(game)} />
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
            <strong>{selectedCard.card.name}</strong> : choisis une action à droite de ta main.
          </>
        )}
        {!sequence && game && !game.over && !selectedCard && prompt}
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
        {game && !game.over && (
          <button type="button" className="sdv-civilisation-secondary" onClick={() => void abandon()}>
            Abandonner
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
          <WonderPicker wonders={wonders} onPick={(wonder) => void start(wonder)} />
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
  const coinsOf = (player: number) => current.lastTurn.find((event) => event.player === player)?.coins ?? 0
  // Identifiant du tour affiché : les animations liées au tour (gains, arrivée de la main) se rejouent à chaque tour.
  const stamp = `${current.age}-${current.turn}`
  const shownNeeds = sequence ? (beforeApply ? (sequence.played?.needs ?? []) : []) : (selectedCard?.needs ?? [])
  const bought = (side: 'fromLeft' | 'fromRight') => shownNeeds.filter((n) => n[side] > 0).map((n) => n.resource)
  // Pendant la révélation, chaque voisin montre la carte qu'il vient de jouer.
  const reveal = (side: 'left' | 'right') =>
    beforeApply ? { event: after.lastTurn[seat[side]], paid: sequence.paid[side] } : undefined
  // La nouvelle main vient du voisin qui passe la sienne, ou du paquet de l'âge au premier tour.
  const from = current.turn === 1 ? 'deck' : current.passesLeft ? 'right' : 'left'
  const arrival =
    from === 'deck'
      ? `Nouvelles cartes de l’âge ${AGES[current.age - 1]}`
      : `Main reçue de ${from === 'left' ? left.name : right.name}`
  const shown = panel === 'left' ? left : right
  const duels = after.players[ME].tokens.slice(-2)
  const shieldsOf = (name: string) => after.players.find((p) => p.name === name)!.shields

  async function play(type: ActionType) {
    const index = selected!
    // Coût et ressources de l'action choisie, déjà calculés par le serveur.
    const { cost, needs } = {
      build: { cost: hand[index].build, needs: hand[index].needs },
      wonder: { cost: current.wonder, needs: current.wonderNeeds },
      discard: { cost: undefined, needs: [] },
    }[type]
    // La carte part de la main vers sa destination : le trajet est mesuré avant que l'écran change.
    const startAt = center(cardsRef.current!.children[index])
    const endAt = center(boardRef.current!.querySelector(TARGETS[type])!)
    setBusy(true)
    setNotice(null)
    setError(null)
    try {
      const next = await server.play(index, type, current.version)
      receive(current, next, { index, dx: endAt.x - startAt.x, dy: endAt.y - startAt.y, cost, needs })
    } catch (err) {
      if (!(err instanceof TurnConflict)) return setError(errorText(err))
      receive(current, err.game)
      setNotice(err.message)
    } finally {
      setBusy(false)
    }
  }

  // Animation de chaque carte de la main : arrivée d'une nouvelle main, envol de la carte jouée, départ des autres.
  function motion(i: number): { motion?: string; style: CSSProperties } {
    const style = { '--i': i } as CSSProperties
    if (!sequence) return { motion: 'sdv-civilisation-card-arrive', style }
    if (sequence.played && i === sequence.played.index) {
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
          myShields={myself.shields}
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
            <span key={current.discards} className="sdv-civilisation-discard sdv-civilisation-pop">
              Défausse · {current.discards}
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
          myShields={myself.shields}
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
                  Contre {token.against} : {after.players[ME].shields} contre {shieldsOf(token.against)} —{' '}
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
          <Results ranked={current.ranking!} me={ME_NAME} isGuest={ctx.isGuest} onReplay={reset} />
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
                className={`sdv-civilisation-passing sdv-civilisation-passing-${sequence.before.passesLeft ? 'left' : 'right'}`}
              >
                {sequence.before.turn === TURNS_PER_AGE
                  ? 'Les dernières cartes partent à la défausse.'
                  : `Les mains passent ${passing(sequence.before.passesLeft)}`}
              </p>
            ) : (
              <div
                ref={cardsRef}
                className={`sdv-civilisation-cards sdv-civilisation-from-${from} sdv-civilisation-pass-${current.passesLeft ? 'left' : 'right'}`}
                style={{ '--hand': hand.length } as CSSProperties}
              >
                {hand.map(({ card, build }, i) => (
                  <CardFace
                    key={`${stamp}-${i}`}
                    card={card}
                    status={cardStatus(build)}
                    selected={i === selected}
                    onSelect={() => setSelected(i)}
                    disabled={sequence !== null || busy}
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
          ) : selectedCard ? (
            <CardDetail
              key={selected}
              card={selectedCard.card}
              player={myself}
              left={left.name}
              right={right.name}
              build={{ cost: selectedCard.build, needs: selectedCard.needs }}
              wonder={{ cost: current.wonder, needs: current.wonderNeeds }}
              onPlay={(type) => void play(type)}
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
  return <SdvCivilisationBoard ctx={ctx} server={httpGameServer} />
}
