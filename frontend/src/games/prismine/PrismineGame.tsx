import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import { Leaderboard } from '@/components/Leaderboard'
import { ApiError } from '@/lib/api'
import type { GameContext, GameProps, LeaderboardEntry } from '../types'
import {
  createPrismineApi,
  type FloorInfo,
  type PrismineApi,
  type ProbeResult,
  type RevealedFloor,
  type RunView,
} from './api'
import { Board, PieceIcon } from './Board'
import { ProbeLog } from './ProbeLog'
import {
  RED,
  SE,
  countPieces,
  emptyGrid,
  entryName,
  prism,
  sameOutcome,
  trace,
  withPiece,
  type Grid,
  type Piece,
  type PrismColor,
} from './engine'
import {
  ERROR_COST,
  FLOOR_REFILL,
  PROBE_COST,
  endStats,
  guessFor,
  knownEntries,
  type Save,
  type Stats as SaveStats,
} from './expedition'
import { lightName, outcomeText, plural, solutionText } from './labels'
import { createSaver, loadExpedition, resumeRun } from './session'
import './prismine.css'

/**
 * Prismine — jeu de déduction solo.
 * Une expédition enchaîne des étages de plus en plus grands ; chaque tir coûte de l'huile de lampe.
 * Le serveur Java arbitre la partie (api.ts) : il garde la carte cachée, applique les règles et classe le
 * score. Le GameContext garde l'identifiant de l'expédition, la carte du joueur et ses statistiques
 * (ctx.save / ctx.loadSave, en base ou dans le navigateur en invité), et fournit le classement
 * (ctx.getLeaderboard) et le record (ctx.getMyBest).
 */

const serverApi = createPrismineApi()

/** Étage affiché. `grid` : la vraie carte, connue seulement une fois l'étage terminé. */
type ShownFloor = FloorInfo & { grid?: Grid; probes: ProbeResult[] }

type Screen =
  | { kind: 'menu' }
  | { kind: 'playing' }
  /** Étage réussi : la vraie carte est dévoilée avant de descendre. */
  | { kind: 'cleared'; floor: RevealedFloor; points: number; perfect: boolean }
  | { kind: 'over'; floor: RevealedFloor; run: RunView; guess: Grid; reason: 'lamp-out' | 'quit'; recorded: boolean }

const SAVE_ERROR = "Ta progression n'a pas pu être sauvegardée. Vérifie ta connexion."
const SERVER_ERROR = 'Le serveur de Prismine ne répond pas. Vérifie ta connexion et réessaie.'

function piecesText(prisms: number, obsidians: number, withObsidian: boolean) {
  const text = plural(prisms, 'prisme')
  return withObsidian ? `${text} et ${plural(obsidians, 'obsidienne')}` : text
}

function differences(a: Grid, b: Grid) {
  const cells = new Set<number>()
  for (let cell = 0; cell < a.length; cell++) {
    if (a[cell] !== b[cell]) cells.add(cell)
  }
  return cells
}

/** `api` : le serveur arbitre ; les tests passent un bouchon à la place (voir PrismineGame.test.tsx). */
export default function PrismineGame({ ctx, api = serverApi }: GameProps & { api?: PrismineApi }) {
  // La partie reste rattachée au ctx qui l'a chargée : si le joueur se connecte, on charge la sienne.
  const [store, setStore] = useState<{ ctx: GameContext; save: Save; run: RunView | null } | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [screen, setScreen] = useState<Screen>({ kind: 'menu' })
  const [busy, setBusy] = useState(false)
  const [hovered, setHovered] = useState<number | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [confirmQuit, setConfirmQuit] = useState(false)
  const [paint, setPaint] = useState<PrismColor>(RED)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [myBest, setMyBest] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const current = store?.ctx === ctx ? store : null
  const save = current?.save ?? null
  const run = current?.run ?? null
  const persist = useMemo(() => createSaver(ctx, () => setError(SAVE_ERROR)), [ctx])

  const refreshScores = useCallback(() => {
    ctx
      .getLeaderboard(10)
      .then(setLeaderboard)
      .catch(() => setError('Le classement est indisponible pour le moment.'))
    ctx
      .getMyBest()
      .then((best) => setMyBest(best?.best_score ?? null))
      .catch(() => setMyBest(null))
  }, [ctx])

  useEffect(() => {
    refreshScores()
  }, [refreshScores])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const loaded = await loadExpedition(ctx)
      const resumed = await resumeRun(api, loaded)
      return { save: resumed ? { ...loaded, guess: guessFor(loaded, resumed) } : { ...loaded, runId: null }, resumed }
    })().then(
      ({ save: loaded, resumed }) => {
        if (cancelled) return
        setStore({ ctx, save: loaded, run: resumed })
        setScreen({ kind: 'menu' })
        setLoadFailed(false)
      },
      () => {
        if (!cancelled) setLoadFailed(true)
      },
    )
    return () => {
      cancelled = true
    }
  }, [ctx, api, loadAttempt])

  // Étage affiché : celui en cours, ou celui qui vient de se terminer (vraie carte dévoilée).
  const finished = screen.kind === 'cleared' || screen.kind === 'over' ? screen : null
  const shownFloor: ShownFloor | null = finished ? finished.floor : run
  const results = useMemo(() => shownFloor?.probes ?? [], [shownFloor])
  const known = useMemo(() => knownEntries(results), [results])
  const selectedIndex = selected === null ? null : (known.get(selected) ?? null)

  function commit(next: Save, nextRun: RunView | null = run) {
    setStore({ ctx, save: next, run: nextRun })
    void persist(next)
  }

  /** Change d'écran avec un plateau neutre : ni sélection, ni message. */
  function show(next: Screen) {
    setScreen(next)
    setSelected(null)
    setHovered(null)
    setFeedback(null)
    setConfirmQuit(false)
  }

  /** Appelle le serveur ; un seul appel à la fois. Une expédition inconnue du serveur ramène au menu. */
  async function call<T>(request: () => Promise<T>): Promise<T | null> {
    if (busy) return null
    setBusy(true)
    try {
      return await request()
    } catch (err) {
      if (err instanceof ApiError && err.status === 404 && save) {
        commit({ ...save, runId: null }, null)
        show({ kind: 'menu' })
        setError(err.message)
      } else {
        setFeedback(err instanceof ApiError && err.status > 0 && err.status < 500 ? err.message : SERVER_ERROR)
      }
      return null
    } finally {
      setBusy(false)
    }
  }

  async function start() {
    if (!save) return
    setError(null)
    const started = await call(() => api.startRun())
    if (!started) return
    commit({ ...save, runId: started.id, guess: emptyGrid(started.size) }, started)
    show({ kind: 'playing' })
  }

  async function handleEntry(entry: number) {
    setSelected(entry)
    if (screen.kind !== 'playing' || !save || !run || known.has(entry)) return
    if (run.oil < PROBE_COST) {
      setFeedback("Ta lampe est vide : valide ta carte ou termine l'expédition.")
      return
    }
    const next = await call(() => api.probe(run.id, entry))
    if (!next) return
    setStore({ ctx, save, run: next })
    setFeedback(null)
  }

  function handlePlace(cell: number, piece: Piece) {
    if (!save || !run) return
    commit({ ...save, guess: withPiece(guessFor(save, run), cell, piece) })
    setFeedback(null)
  }

  async function handleValidate() {
    if (!save || !run) return
    setConfirmQuit(false)
    const guess = guessFor(save, run)
    const verdict = await call(() => api.validate(run.id, guess))
    if (!verdict) return
    switch (verdict.kind) {
      case 'contradiction': {
        const numbers = verdict.contradictions.map((index) => index + 1).join(', ')
        const which = verdict.contradictions.length > 1 ? `les tirs ${numbers}` : `le tir ${numbers}`
        setFeedback(`Ta carte n'explique pas ${which} : corrige-la avant de valider.`)
        break
      }
      case 'wrong':
        setStore({ ctx, save, run: verdict.run })
        setSelected(verdict.entry)
        setFeedback(
          `Raté : le tir depuis ${entryName(verdict.entry, run.size)} ne donne pas ce que prévoit ta carte. ` +
            `Il est ajouté au journal (−${plural(ERROR_COST, 'dose')} d'huile).`,
        )
        break
      case 'cleared':
        commit({ ...save, guess: emptyGrid(verdict.run.size) }, verdict.run)
        show({ kind: 'cleared', floor: verdict.floor, points: verdict.points, perfect: verdict.perfect })
        break
      case 'lamp-out':
        finish(verdict.run, verdict.floor, guess, 'lamp-out', verdict.recorded)
        break
    }
  }

  async function quit() {
    if (!save || !run) return
    const guess = guessFor(save, run)
    const ending = await call(() => api.endRun(run.id))
    if (ending) finish(ending.run, ending.floor, guess, 'quit', ending.recorded)
  }

  function finish(ended: RunView, floor: RevealedFloor, guess: Grid, reason: 'lamp-out' | 'quit', recorded: boolean) {
    if (!save) return
    commit(endStats(save, ended), null)
    show({ kind: 'over', floor, run: ended, guess, reason, recorded })
    if (recorded) refreshScores()
  }

  const panel = {
    results,
    known,
    focusEntry: hovered ?? selected,
    onEntry: (entry: number) => void handleEntry(entry),
    onHover: setHovered,
  }

  let main: ReactNode
  if (!save) {
    main = loadFailed ? (
      <div className="prismine-menu">
        <p className="error">Impossible de charger ta progression. Vérifie ta connexion, puis réessaie.</p>
        <button
          type="button"
          onClick={() => {
            setLoadFailed(false)
            setLoadAttempt((n) => n + 1)
          }}
        >
          Réessayer
        </button>
      </div>
    ) : (
      <p className="muted">Chargement…</p>
    )
  } else if (screen.kind === 'playing' && run) {
    const guess = guessFor(save, run)
    const placed = countPieces(guess)
    const withObsidian = run.obsidians > 0
    main = (
      <>
        <Stats depth={run.depth} oil={run.oil} score={run.score} />
        <p className="muted prismine-pieces">
          À trouver : {piecesText(run.prisms, run.obsidians, withObsidian)} · sur ta carte :{' '}
          {piecesText(placed.prisms, placed.obsidians, withObsidian)}
        </p>
        <FloorPanel
          floor={run}
          guess={guess}
          // La couleur choisie à un étage précédent peut ne pas exister ici.
          paint={run.colors.includes(paint) ? paint : run.colors[0]}
          onPaint={setPaint}
          onPlace={handlePlace}
          {...panel}
        />
        <p role="status" className="error prismine-feedback">
          {feedback}
        </p>
        <div className="prismine-actions">
          <button type="button" onClick={() => void handleValidate()} disabled={busy}>
            Valider ma carte
          </button>
          {confirmQuit ? (
            <span className="prismine-confirm">
              Terminer avec {plural(run.score, 'point')} ?
              <button type="button" className="small" onClick={() => void quit()} disabled={busy}>
                Terminer
              </button>
              <button type="button" className="link" onClick={() => setConfirmQuit(false)}>
                Annuler
              </button>
            </span>
          ) : (
            <button type="button" className="link" onClick={() => setConfirmQuit(true)}>
              Terminer l'expédition
            </button>
          )}
        </div>
      </>
    )
  } else if (screen.kind === 'cleared' && run) {
    main = (
      <>
        <p className="success" role="status">
          Étage {screen.floor.depth} réussi : +{plural(screen.points, 'point')}
          {screen.perfect ? ' (bonus sans erreur compris)' : ''} et +{plural(FLOOR_REFILL, 'dose')} d'huile.
        </p>
        <Stats depth={run.depth} oil={run.oil} score={run.score} />
        <div className="prismine-actions">
          <button type="button" onClick={() => show({ kind: 'playing' })}>
            Descendre à l'étage {run.depth}
          </button>
        </div>
        <FloorPanel floor={screen.floor} guess={null} {...panel} />
      </>
    )
  } else if (screen.kind === 'over') {
    const { run: ended } = screen
    const mistakes = differences(screen.guess, screen.floor.grid)
    main = (
      <>
        <p className="result">
          Score : <strong>{ended.score}</strong>
        </p>
        <p>
          {screen.reason === 'lamp-out'
            ? `Ta lampe s'est éteinte à l'étage ${ended.depth}.`
            : `Expédition terminée à l'étage ${ended.depth}.`}
        </p>
        {ended.score === 0 ? (
          <p className="muted">Réussis au moins un étage pour marquer des points.</p>
        ) : (
          !screen.recorded && <p className="muted">Connecte-toi pour apparaître au classement.</p>
        )}
        <p role="status" className="error prismine-feedback">
          {feedback}
        </p>
        <div className="prismine-actions">
          <button type="button" className="big" onClick={() => void start()} disabled={busy}>
            Rejouer
          </button>
        </div>
        <FloorPanel floor={screen.floor} guess={null} mistakes={mistakes} {...panel} />
        {mistakes.size > 0 && <p className="muted">Contour en pointillés : case où ta carte différait de la vraie.</p>}
      </>
    )
  } else {
    main = (
      <Menu
        run={run}
        stats={save.stats}
        isGuest={ctx.isGuest}
        busy={busy}
        feedback={feedback}
        onStart={() => void start()}
        onResume={() => show({ kind: 'playing' })}
      />
    )
  }

  return (
    <div className="prismine">
      <div className="card prismine-main">
        {main}
        {error && <p className="error">{error}</p>}
      </div>
      <div className="card prismine-side">
        {screen.kind !== 'menu' && shownFloor && (
          <section>
            <h2>Journal</h2>
            <ProbeLog
              results={results}
              size={shownFloor.size}
              guess={screen.kind === 'playing' && run ? guessFor(save!, run) : null}
              selectedIndex={selectedIndex}
              onSelect={setSelected}
              onHover={setHovered}
            />
          </section>
        )}
        <section>
          <h2>Classement</h2>
          <p className="muted">
            {ctx.isGuest
              ? `Ton record sur cet appareil : ${save?.stats.bestScore ?? 0}`
              : `Ton record : ${myBest ?? '—'}`}
          </p>
          <Leaderboard entries={leaderboard} currentUserId={ctx.player?.id} />
        </section>
      </div>
    </div>
  )
}

function Stats({ depth, oil, score }: { depth: number; oil: number; score: number }) {
  return (
    <dl className="prismine-stats">
      <div>
        <dt>Étage</dt>
        <dd>{depth}</dd>
      </div>
      <div>
        <dt>Huile</dt>
        <dd>{oil}</dd>
      </div>
      <div>
        <dt>Score</dt>
        <dd>{score}</dd>
      </div>
    </dl>
  )
}

type MenuProps = {
  run: RunView | null
  stats: SaveStats
  isGuest: boolean
  busy: boolean
  feedback: string | null
  onStart(): void
  onResume(): void
}

function Menu({ run, stats, isGuest, busy, feedback, onStart, onResume }: MenuProps) {
  return (
    <div className="prismine-menu">
      <p>
        Ta lampe est ta seule alliée. Envoie des faisceaux dans la galerie, regarde où ils ressortent et retrouve où se
        cachent les prismes.
      </p>
      <details className="prismine-rules" open={stats.runs === 0 && !run}>
        <summary>Règles</summary>
        <ul>
          <li>
            Clique une entrée sur le bord : ta lampe envoie un faisceau ({plural(PROBE_COST, 'dose')} d'huile). Tu vois
            où il ressort, de quelle couleur, et combien de fois il a rebondi.
          </li>
          <li>
            Un prisme triangulaire dévie la lumière d'un quart de tour sur sa face en biais, et la renvoie d'où elle
            vient sur ses faces plates. L'obsidienne l'absorbe.
          </li>
          <li>
            Le faisceau part blanc et prend la couleur de chaque prisme touché : rouge + vert = jaune, rouge + bleu =
            magenta, vert + bleu = cyan, les trois = irisé.
          </li>
          <li>Pose tes pièces sur la grille : le journal indique les tirs que ta carte explique.</li>
          <li>
            Ta carte est juste si chaque entrée donne le même résultat que la vraie galerie. Une erreur coûte{' '}
            {plural(ERROR_COST, 'dose')} d'huile et révèle un tir.
          </li>
          <li>
            Étage réussi : 100 points × l'étage (+50 % sans erreur) et {plural(FLOOR_REFILL, 'dose')} d'huile. Si tu ne
            peux plus payer une erreur, ta lampe s'éteint.
          </li>
        </ul>
      </details>
      {run ? (
        <>
          <button type="button" className="big" onClick={onResume}>
            Reprendre
          </button>
          <p className="muted">
            Expédition en cours : étage {run.depth}, {plural(run.oil, 'dose')} d'huile, {plural(run.score, 'point')}.
          </p>
        </>
      ) : (
        <button type="button" className="big" onClick={onStart} disabled={busy}>
          Jouer
        </button>
      )}
      {feedback && (
        <p role="status" className="error">
          {feedback}
        </p>
      )}
      {stats.runs > 0 && (
        <p className="muted">
          Expéditions : {stats.runs} · Meilleur étage : {stats.bestDepth} · Record{isGuest ? ' sur cet appareil' : ''} :{' '}
          {stats.bestScore}
        </p>
      )}
    </div>
  )
}

type FloorPanelProps = {
  floor: ShownFloor
  /** Carte du joueur (étage en cours) ; null : étage terminé, on montre la vraie carte. */
  guess: Grid | null
  results: ProbeResult[]
  known: ReadonlyMap<number, number>
  /** Entrée survolée ou sélectionnée. */
  focusEntry: number | null
  mistakes?: ReadonlySet<number>
  /** Couleur des prismes posés (étage en cours). */
  paint?: PrismColor
  onPaint?(color: PrismColor): void
  onEntry(entry: number): void
  onHover(entry: number | null): void
  onPlace?(cell: number, piece: Piece): void
}

function FloorPanel({
  floor,
  guess,
  results,
  known,
  focusEntry,
  mistakes,
  paint = floor.colors[0],
  onPaint = () => {},
  onEntry,
  onHover,
  onPlace,
}: FloorPanelProps) {
  const helpId = useId()
  const index = focusEntry === null ? undefined : known.get(focusEntry)
  const probe = index === undefined ? null : results[index]
  // Le trajet d'un tir connu part toujours de son entrée d'origine.
  const beamEntry = probe ? probe.entry : focusEntry
  const withObsidian = floor.obsidians > 0
  const truth = floor.grid ?? emptyGrid(floor.size)

  return (
    <>
      <Board
        size={floor.size}
        grid={guess ?? truth}
        results={results}
        known={known}
        beamEntry={beamEntry}
        withObsidian={withObsidian}
        paint={paint}
        colors={floor.colors}
        onPaint={onPaint}
        mistakes={mistakes}
        describedBy={guess === null ? undefined : helpId}
        onEntry={onEntry}
        onHover={onHover}
        onPlace={onPlace}
      />
      <p className="prismine-info">
        <BeamInfo floor={floor} truth={truth} guess={guess} entry={beamEntry} probe={probe} index={index} />
      </p>
      {guess === null ? (
        <p className="prismine-sr">
          Solution de l'étage {floor.depth}. {solutionText(truth, floor.size)}
        </p>
      ) : (
        <>
          {floor.colors.length > 1 && (
            <div className="prismine-palette" role="group" aria-label="Couleur des prismes posés">
              <span className="muted">Couleur posée :</span>
              {floor.colors.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`prismine-light-${color}`}
                  aria-pressed={color === paint}
                  onClick={() => onPaint(color)}
                >
                  <PieceIcon piece={prism(color, SE)} />
                  {lightName(color)}
                </button>
              ))}
            </div>
          )}
          <p id={helpId} className="muted prismine-help">
            Clic sur une case : poser, tourner ou repeindre un prisme (clic droit : sens inverse). Clavier : flèches,
            Entrée, 1 à 4 les prismes ◢ ◣ ◤ ◥{withObsidian ? ', 5 obsidienne' : ''}, 0 vider
            {floor.colors.length > 1 ? ', R V B la couleur' : ''}.
          </p>
        </>
      )}
    </>
  )
}

type BeamInfoProps = {
  floor: FloorInfo
  /** Vraie carte (étage terminé). */
  truth: Grid
  guess: Grid | null
  entry: number | null
  probe: ProbeResult | null
  index: number | undefined
}

/** Décrit le trajet tracé : le vrai en fin d'étage, sinon celui que prévoit la carte du joueur. */
function BeamInfo({ floor, truth, guess, entry, probe, index }: BeamInfoProps) {
  if (entry === null) {
    return (
      <span className="muted">
        {guess === null
          ? 'Survole une entrée ou un tir du journal pour voir le vrai trajet du faisceau.'
          : 'Survole une entrée : le trajet tracé est celui que prévoit ta carte.'}
      </span>
    )
  }
  const name = entryName(entry, floor.size)
  const shot = probe && index !== undefined ? `Tir ${index + 1} : ` : ''
  if (guess === null) return <>{`${shot}${name}, ${outcomeText(trace(truth, floor.size, entry), floor.size)}.`}</>

  const predicted = trace(guess, floor.size, entry)
  if (!probe) return <>{`${name} : pas encore exploré. Ta carte prévoit : ${outcomeText(predicted, floor.size)}.`}</>
  return (
    <>
      {`${shot}${name}, ${outcomeText(probe, floor.size)}. `}
      {sameOutcome(probe, predicted) ? (
        <span className="prismine-ok">✓ Ta carte donne le même résultat.</span>
      ) : (
        <span className="prismine-ko">✗ Ta carte prévoit : {outcomeText(predicted, floor.size)}.</span>
      )}
    </>
  )
}
