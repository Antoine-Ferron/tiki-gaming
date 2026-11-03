import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import { Leaderboard } from '@/components/Leaderboard'
import type { GameContext, GameProps, LeaderboardEntry } from '../types'
import { Board } from './Board'
import { ProbeLog } from './ProbeLog'
import {
  countPieces,
  entryName,
  generateFloor,
  randomSeed,
  sameOutcome,
  trace,
  withPiece,
  type Floor,
  type Grid,
  type Piece,
} from './engine'
import {
  ERROR_COST,
  FLOOR_REFILL,
  PROBE_COST,
  endRun,
  fire,
  knownEntries,
  newRun,
  parseSave,
  probeResults,
  validate,
  type Probe,
  type ProbeResult,
  type Run,
  type Save,
} from './expedition'
import { outcomeText, plural, solutionText } from './labels'
import './prismine.css'

/**
 * Prismine — jeu de déduction solo.
 * Une expédition enchaîne des étages de plus en plus grands ; chaque tir coûte de l'huile de lampe.
 * Utilise tout le GameContext : expédition en cours sauvegardée à chaque action (ctx.save, en base ou
 * dans le navigateur en invité) et reprise à l'ouverture (ctx.loadSave), score envoyé en fin
 * d'expédition (ctx.submitScore), classement (ctx.getLeaderboard) et record (ctx.getMyBest).
 */

type Screen =
  | { kind: 'menu' }
  | { kind: 'playing' }
  /** Étage réussi : la vraie carte est dévoilée avant de descendre. */
  | { kind: 'cleared'; floor: Floor; probes: Probe[]; points: number; perfect: boolean }
  | { kind: 'over'; floor: Floor; probes: Probe[]; run: Run; reason: 'lamp-out' | 'quit' }

const SAVE_ERROR = "Ta progression n'a pas pu être sauvegardée. Vérifie ta connexion."

/** Écrit les sauvegardes l'une après l'autre ; pendant une écriture, seule la plus récente attend. */
function createSaver(ctx: GameContext, onError: () => void) {
  let pending: Save | null = null
  let writing = false
  return async (data: Save) => {
    pending = data
    if (writing) return
    writing = true
    while (pending) {
      const next: Save = pending
      pending = null
      try {
        await ctx.save(next)
      } catch {
        onError()
      }
    }
    writing = false
  }
}

function piecesText(crystals: number, obsidians: number, withObsidian: boolean) {
  const text = plural(crystals, 'cristal', 'cristaux')
  return withObsidian ? `${text} et ${plural(obsidians, 'obsidienne')}` : text
}

function differences(a: Grid, b: Grid) {
  const cells = new Set<number>()
  for (let cell = 0; cell < a.length; cell++) {
    if (a[cell] !== b[cell]) cells.add(cell)
  }
  return cells
}

export default function PrismineGame({ ctx }: GameProps) {
  // La sauvegarde reste rattachée au ctx qui l'a chargée : si le joueur se connecte, on charge la sienne.
  const [store, setStore] = useState<{ ctx: GameContext; save: Save } | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [screen, setScreen] = useState<Screen>({ kind: 'menu' })
  const [hovered, setHovered] = useState<number | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [confirmQuit, setConfirmQuit] = useState(false)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [myBest, setMyBest] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const save = store?.ctx === ctx ? store.save : null
  const run = save?.run ?? null
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
    ctx.loadSave().then(
      (raw) => {
        if (cancelled) return
        setStore({ ctx, save: parseSave(raw) })
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
  }, [ctx, loadAttempt])

  const depth = run?.depth
  const seed = run?.seed
  const floor = useMemo(
    () => (depth === undefined || seed === undefined ? null : generateFloor(depth, seed)),
    [depth, seed],
  )

  // Étage affiché : celui en cours, ou celui qui vient de se terminer (vraie carte dévoilée).
  const finished = screen.kind === 'cleared' || screen.kind === 'over' ? screen : null
  const shownFloor = finished ? finished.floor : floor
  const shownProbes = finished ? finished.probes : run?.probes
  const results = useMemo(
    () => (shownFloor && shownProbes ? probeResults(shownFloor, shownProbes) : []),
    [shownFloor, shownProbes],
  )
  const known = useMemo(() => knownEntries(results), [results])
  const selectedIndex = selected === null ? null : (known.get(selected) ?? null)

  function commit(next: Save) {
    setStore({ ctx, save: next })
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

  function start() {
    if (!save) return
    commit({ ...save, run: newRun(randomSeed()) })
    show({ kind: 'playing' })
  }

  function handleEntry(entry: number) {
    setSelected(entry)
    if (screen.kind !== 'playing' || !save || !run || known.has(entry)) return
    if (run.oil < PROBE_COST) {
      setFeedback("Ta lampe est vide : valide ta carte ou termine l'expédition.")
      return
    }
    commit({ ...save, run: fire(run, entry) })
    setFeedback(null)
  }

  function handlePlace(cell: number, piece: Piece) {
    if (!save || !run) return
    commit({ ...save, run: { ...run, guess: withPiece(run.guess, cell, piece) } })
    setFeedback(null)
  }

  function handleValidate() {
    if (!save || !run || !floor) return
    setConfirmQuit(false)
    const verdict = validate(run, floor, randomSeed())
    switch (verdict.kind) {
      case 'contradiction': {
        const numbers = verdict.probes.map((index) => index + 1).join(', ')
        const which = verdict.probes.length > 1 ? `les tirs ${numbers}` : `le tir ${numbers}`
        setFeedback(`Ta carte n'explique pas ${which} : corrige-la avant de valider.`)
        break
      }
      case 'wrong':
        commit({ ...save, run: verdict.next })
        setSelected(verdict.entry)
        setFeedback(
          `Raté : le tir depuis ${entryName(verdict.entry, floor.size)} ne donne pas ce que prévoit ta carte. ` +
            `Il est ajouté au journal (−${plural(ERROR_COST, 'dose')} d'huile).`,
        )
        break
      case 'cleared':
        commit({ ...save, run: verdict.next })
        show({ kind: 'cleared', floor, probes: run.probes, points: verdict.points, perfect: verdict.perfect })
        break
      case 'lamp-out':
        finish(verdict.run, 'lamp-out')
        break
    }
  }

  function finish(ended: Run, reason: 'lamp-out' | 'quit') {
    if (!save || !floor) return
    commit(endRun(save, ended))
    show({ kind: 'over', floor, probes: ended.probes, run: ended, reason })
    if (ended.score > 0) {
      ctx
        .submitScore(ended.score, { depth: ended.depth, probes: ended.totalProbes, errors: ended.totalErrors })
        .then(refreshScores)
        .catch(() => setError("Ton score n'a pas pu être enregistré. Vérifie ta connexion."))
    }
  }

  const panel = {
    results,
    known,
    focusEntry: hovered ?? selected,
    onEntry: handleEntry,
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
  } else if (screen.kind === 'playing' && run && floor) {
    const placed = countPieces(run.guess)
    const withObsidian = floor.obsidians > 0
    main = (
      <>
        <Stats depth={run.depth} oil={run.oil} score={run.score} />
        <p className="muted prismine-pieces">
          À trouver : {piecesText(floor.crystals, floor.obsidians, withObsidian)} · sur ta carte :{' '}
          {piecesText(placed.crystals, placed.obsidians, withObsidian)}
        </p>
        <FloorPanel floor={floor} guess={run.guess} onPlace={handlePlace} {...panel} />
        <p role="status" className="error prismine-feedback">
          {feedback}
        </p>
        <div className="prismine-actions">
          <button type="button" onClick={handleValidate}>
            Valider ma carte
          </button>
          {confirmQuit ? (
            <span className="prismine-confirm">
              Terminer avec {plural(run.score, 'point')} ?
              <button type="button" className="small" onClick={() => finish(run, 'quit')}>
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
    const mistakes = differences(ended.guess, screen.floor.grid)
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
          ctx.isGuest && <p className="muted">Connecte-toi pour apparaître au classement.</p>
        )}
        <div className="prismine-actions">
          <button type="button" className="big" onClick={start}>
            Rejouer
          </button>
        </div>
        <FloorPanel floor={screen.floor} guess={null} mistakes={mistakes} {...panel} />
        {mistakes.size > 0 && <p className="muted">Contour en pointillés : case où ta carte différait de la vraie.</p>}
      </>
    )
  } else {
    main = <Menu save={save} isGuest={ctx.isGuest} onStart={start} onResume={() => show({ kind: 'playing' })} />
  }

  return (
    <div className="prismine">
      <div className="card prismine-main">
        {main}
        {error && <p className="error">{error}</p>}
      </div>
      <div className="card prismine-side">
        {screen.kind !== 'menu' && save && shownFloor && (
          <section>
            <h2>Journal</h2>
            <ProbeLog
              results={results}
              size={shownFloor.size}
              guess={screen.kind === 'playing' && run ? run.guess : null}
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

type MenuProps = { save: Save; isGuest: boolean; onStart(): void; onResume(): void }

function Menu({ save: { run, stats }, isGuest, onStart, onResume }: MenuProps) {
  return (
    <div className="prismine-menu">
      <p>
        Ta lampe est ta seule alliée. Envoie des faisceaux dans la galerie, regarde où ils ressortent et retrouve où se
        cachent les cristaux.
      </p>
      <details className="prismine-rules" open={stats.runs === 0 && !run}>
        <summary>Règles</summary>
        <ul>
          <li>
            Clique une entrée sur le bord : ta lampe envoie un faisceau ({plural(PROBE_COST, 'dose')} d'huile). Tu vois
            où il ressort et combien de fois il a rebondi.
          </li>
          <li>
            Un cristal «&nbsp;/&nbsp;» ou «&nbsp;\&nbsp;» dévie la lumière d'un quart de tour. L'obsidienne l'absorbe.
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
        <button type="button" className="big" onClick={onStart}>
          Jouer
        </button>
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
  floor: Floor
  /** Carte du joueur (étage en cours) ; null : étage terminé, on montre la vraie carte. */
  guess: Grid | null
  results: ProbeResult[]
  known: ReadonlyMap<number, number>
  /** Entrée survolée ou sélectionnée. */
  focusEntry: number | null
  mistakes?: ReadonlySet<number>
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

  return (
    <>
      <Board
        size={floor.size}
        grid={guess ?? floor.grid}
        results={results}
        known={known}
        beamEntry={beamEntry}
        withObsidian={withObsidian}
        mistakes={mistakes}
        describedBy={guess === null ? undefined : helpId}
        onEntry={onEntry}
        onHover={onHover}
        onPlace={onPlace}
      />
      <p className="prismine-info">
        <BeamInfo floor={floor} guess={guess} entry={beamEntry} probe={probe} index={index} />
      </p>
      {guess === null ? (
        <p className="prismine-sr">
          Solution de l'étage {floor.depth}. {solutionText(floor.grid, floor.size)}
        </p>
      ) : (
        <p id={helpId} className="muted prismine-help">
          Clic sur une case : poser ou changer une pièce (clic droit : sens inverse). Clavier : flèches, Entrée,
          1&nbsp;«&nbsp;/&nbsp;», 2&nbsp;«&nbsp;\&nbsp;»{withObsidian ? ', 3 obsidienne' : ''}, 0 vider.
        </p>
      )}
    </>
  )
}

type BeamInfoProps = {
  floor: Floor
  guess: Grid | null
  entry: number | null
  probe: ProbeResult | null
  index: number | undefined
}

/** Décrit le trajet tracé : le vrai en fin d'étage, sinon celui que prévoit la carte du joueur. */
function BeamInfo({ floor, guess, entry, probe, index }: BeamInfoProps) {
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
  if (guess === null) return <>{`${shot}${name}, ${outcomeText(trace(floor.grid, floor.size, entry), floor.size)}.`}</>

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
