import { useCallback, useEffect, useState } from 'react'
import { Leaderboard } from '@/components/Leaderboard'
import type { RealtimeConnection } from '../ports'
import type { GameContext, GameProps, LeaderboardEntry } from '../types'
import FleetPlacementBoard from './FleetPlacementBoard'
import {
  GRID_SIZE,
  computeUnlocks,
  coordKey,
  fireVolleyAndSubmitIfOver,
  fleetStatus,
  fleetStatusFromSunkNames,
  scanZone,
  shipIndex,
  zoneCoords,
  type Coord,
  type FleetStatus,
  type PlacedShip,
  type Ship,
  type ShotResult,
  type VolleyShot,
} from './logic'
import { availableBonuses, type Bonus } from './network'
import { useNetGame } from './useNetGame'
import './bataille-navale.css'

type Seat = 1 | 2
type Mode = 'local' | 'online' | null

type PlayerState = {
  fleet: PlacedShip[]
  shotsOnOpponent: Set<string>
  resultsOnOpponent: Map<string, 'hit' | 'miss'>
  radarRevealsOnOpponent: Set<string>
  hits: number
  shipsSunk: number
  usedBonuses: Set<Bonus>
}

function emptyPlayerState(): PlayerState {
  return {
    fleet: [],
    shotsOnOpponent: new Set(),
    resultsOnOpponent: new Map(),
    radarRevealsOnOpponent: new Set(),
    hits: 0,
    shipsSunk: 0,
    usedBonuses: new Set(),
  }
}

/** Bonus débloqués (par mes tirs/navires coulés) et pas encore utilisés : seuls ceux-ci sont jouables. */
function unlockedBonuses(shotsFired: number, shipsSunk: number, used: ReadonlySet<Bonus>): Bonus[] {
  const unlocks = computeUnlocks(shotsFired, shipsSunk)
  return (['salvo', 'radar', 'nuke'] as const).filter((b) => unlocks[b] && !used.has(b))
}

function describeOutcomes(outcomes: VolleyShot[]): string {
  const sunkNames = outcomes.flatMap((o) => (o.sunk ? [o.sunk.name] : []))
  if (outcomes.length === 1) {
    if (outcomes[0].result !== 'hit') return "À l'eau."
    return sunkNames.length ? `${sunkNames[0]} coulé !` : 'Touché !'
  }
  const hits = outcomes.filter((o) => o.result === 'hit').length
  const summary = `${hits} touché(s) sur ${outcomes.length}.`
  return sunkNames.length ? `${summary} ${sunkNames.join(', ')} coulé(s) !` : summary
}

/** Décrit le dernier tir en ligne pour les deux camps : qui a tiré, touché, et éventuellement coulé. */
function describeFireEvent(by: number, results: ShotResult[], sunk: Ship[], mySeat: number): string {
  const subject = by === mySeat ? 'Tu as' : "L'adversaire a"
  const sunkNames = sunk.map((s) => s.name)
  if (results.length === 1) {
    if (results[0] !== 'hit') return `${subject} tiré à l'eau.`
    return sunkNames.length ? `${subject} coulé le ${sunkNames[0]} !` : `${subject} touché !`
  }
  const hits = results.filter((r) => r === 'hit').length
  const summary = `${subject} touché ${hits} fois sur ${results.length}.`
  return sunkNames.length ? `${summary} ${sunkNames.join(', ')} coulé(s) !` : summary
}

/**
 * Le socle garde une salle ouverte jusqu'à 1 h d'inactivité : si on la quitte sans prévenir (fermeture de
 * l'onglet, rechargement), créer une nouvelle salle échoue ensuite avec « Tu as déjà une salle ouverte… ».
 * On retient le dernier code sur cet appareil pour pouvoir la rejoindre — ou la fermer, puisque `joinRoom`
 * est idempotent pour son créateur et que `close()` quitte déjà proprement la salle côté serveur.
 */
const ONLINE_ROOM_KEY = 'tiki:bataille-navale:online-room'

function loadSavedRoomCode(): string | null {
  try {
    return localStorage.getItem(ONLINE_ROOM_KEY)
  } catch {
    return null
  }
}

function saveRoomCode(code: string) {
  try {
    localStorage.setItem(ONLINE_ROOM_KEY, code)
  } catch {
    // Stockage indisponible : on perd seulement la possibilité de retrouver cette salle après un rechargement.
  }
}

function forgetRoomCode() {
  try {
    localStorage.removeItem(ONLINE_ROOM_KEY)
  } catch {
    // Rien à faire : au pire, le code restera affiché comme « peut-être » ouvert jusqu'à son expiration.
  }
}

const BONUS_LABELS: Record<Bonus, string> = {
  salvo: 'Salve (3 tirs)',
  radar: 'Radar (zone 3×3)',
  nuke: 'Frappe nucléaire (bloc 3×3)',
}

type FiringBoardProps = {
  label: string
  disabled: boolean
  results: ReadonlyMap<string, 'hit' | 'miss'>
  radarHints: ReadonlySet<string>
  bonuses: Bonus[]
  onFire: (targets: Coord[], bonus?: 'salvo' | 'nuke') => void
  onRadar: (zone: Coord[]) => void
}

/**
 * Grille sur laquelle on tire, partagée par le mode local et le mode en ligne. Un bonus « armé » change ce que
 * le prochain clic déclenche : frappe/radar visent une zone 3×3 autour de la case cliquée, salve accumule 3
 * cases avant d'envoyer un seul tir groupé.
 */
function FiringBoard({ label, disabled, results, radarHints, bonuses, onFire, onRadar }: FiringBoardProps) {
  const [armed, setArmed] = useState<'normal' | Bonus>('normal')
  const [selected, setSelected] = useState<Coord[]>([])

  function toggleBonus(bonus: Bonus) {
    setSelected([])
    setArmed((current) => (current === bonus ? 'normal' : bonus))
  }

  function clickCell(cell: Coord) {
    if (disabled || results.has(coordKey(cell))) return
    if (armed === 'nuke') {
      onFire(zoneCoords(cell), 'nuke')
      setArmed('normal')
      return
    }
    if (armed === 'radar') {
      onRadar(zoneCoords(cell))
      setArmed('normal')
      return
    }
    if (armed === 'salvo') {
      const next = [...selected, cell]
      if (next.length >= 3) {
        onFire(next, 'salvo')
        setSelected([])
        setArmed('normal')
      } else {
        setSelected(next)
      }
      return
    }
    onFire([cell])
  }

  const selectedKeys = new Set(selected.map(coordKey))

  return (
    <div className="bn-firing-board">
      {bonuses.length > 0 && (
        <div className="bn-bonus-bar">
          {bonuses.map((bonus) => (
            <button
              key={bonus}
              type="button"
              className="small"
              disabled={disabled}
              aria-pressed={armed === bonus}
              onClick={() => toggleBonus(bonus)}
            >
              {BONUS_LABELS[bonus]}
            </button>
          ))}
        </div>
      )}
      {armed === 'salvo' && <p className="muted">Choisis encore {3 - selected.length} case(s) pour la salve.</p>}
      {armed === 'nuke' && <p className="muted">Choisis le centre de la frappe nucléaire.</p>}
      {armed === 'radar' && <p className="muted">Choisis le centre de la zone à scanner.</p>}

      <div className="bn-grid" role="grid" aria-label={label}>
        {Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, i) => {
          const cell: Coord = { row: Math.floor(i / GRID_SIZE), col: i % GRID_SIZE }
          const key = coordKey(cell)
          const result = results.get(key)
          const classes = ['bn-cell']
          if (result) classes.push(result)
          else if (radarHints.has(key)) classes.push('radar')
          else if (selectedKeys.has(key)) classes.push('selected')
          return (
            <button
              key={key}
              type="button"
              className={classes.join(' ')}
              disabled={disabled || !!result}
              onClick={() => clickCell(cell)}
              aria-label={`Case ${cell.row + 1},${cell.col + 1}${result ? `, ${result === 'hit' ? 'touché' : 'à l’eau'}` : ''}`}
            />
          )
        })}
      </div>
    </div>
  )
}

/** Mon propre plateau : lecture seule, montre mes navires et les cases où l'adversaire a tiré. */
function OwnBoard({ fleet, shotsOnMe }: { fleet: PlacedShip[]; shotsOnMe: ReadonlySet<string> }) {
  const shipByCell = new Map<string, Ship>(fleet.flatMap((p) => p.coords.map((c) => [coordKey(c), p.ship] as const)))
  return (
    <div className="bn-grid bn-grid-own" role="grid" aria-label="Ta flotte">
      {Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, i) => {
        const cell: Coord = { row: Math.floor(i / GRID_SIZE), col: i % GRID_SIZE }
        const key = coordKey(cell)
        const ship = shipByCell.get(key)
        const shot = shotsOnMe.has(key)
        const classes = ['bn-cell', 'bn-cell-own']
        if (ship) classes.push(`ship-${shipIndex(ship)}`)
        if (shot) classes.push(ship ? 'hit' : 'miss')
        return (
          <div
            key={key}
            className={classes.join(' ')}
            aria-label={`Case ${cell.row + 1},${cell.col + 1}${ship ? `, ${ship.name}` : ''}${shot ? (ship ? ', touché' : ", à l'eau") : ''}`}
          />
        )
      })}
    </div>
  )
}

type StatusPanelProps = {
  myFleet: FleetStatus[]
  opponentFleet: FleetStatus[]
  shotsFired: number
  hits: number
}

/** État de la partie : quels navires (de chaque camp) sont coulés, et mes statistiques de tir. */
function StatusPanel({ myFleet, opponentFleet, shotsFired, hits }: StatusPanelProps) {
  const accuracy = shotsFired > 0 ? Math.round((hits / shotsFired) * 100) : 0
  return (
    <div className="bn-status-panel">
      <h3>État de la partie</h3>
      <div>
        <p className="muted">Mes navires</p>
        <ul className="bn-fleet-status">
          {myFleet.map(({ ship, sunk }) => (
            <li key={ship.name} className={sunk ? 'sunk' : undefined}>
              <span className={`bn-ship-swatch ship-${shipIndex(ship)}`} aria-hidden="true" />
              {ship.name} {sunk && '(coulé)'}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <p className="muted">Navires adverses</p>
        <ul className="bn-fleet-status">
          {opponentFleet.map(({ ship, sunk }) => (
            <li key={ship.name} className={sunk ? 'sunk' : undefined}>
              <span className={`bn-ship-swatch ship-${shipIndex(ship)}`} aria-hidden="true" />
              {ship.name} {sunk && '(coulé)'}
            </li>
          ))}
        </ul>
      </div>
      <dl className="bn-stats">
        <div>
          <dt>Tirs</dt>
          <dd>{shotsFired}</dd>
        </div>
        <div>
          <dt>Touchés</dt>
          <dd>{hits}</dd>
        </div>
        <div>
          <dt>Précision</dt>
          <dd>{accuracy}%</dd>
        </div>
      </dl>
    </div>
  )
}

type OnlineBattleProps = {
  connection: RealtimeConnection
  myFleet: PlacedShip[]
  augmented: boolean
  ctx: GameContext
  onExit: () => void
  onGameOver: () => void
}

function OnlineBattle({ connection, myFleet, augmented, ctx, onExit, onGameOver }: OnlineBattleProps) {
  const { state, fire, useRadar } = useNetGame(connection, myFleet, augmented, ctx)

  useEffect(() => {
    if (state.phase === 'over') onGameOver()
  }, [state.phase, onGameOver])

  if (state.disconnected) {
    return (
      <div className="card bn-over">
        <h2>La partie ne peut plus continuer</h2>
        <p className="error">
          L'adversaire a quitté la partie, la connexion a été coupée, ou son appareil a rechargé la page. Il
          faut recommencer une nouvelle partie.
        </p>
        <button type="button" className="big" onClick={onExit}>
          Retour au menu
        </button>
      </div>
    )
  }

  if (state.phase === 'placement') {
    return (
      <div className="card">
        <h2>En attente de l'adversaire</h2>
        <p className="muted">Code de la partie : {connection.code}</p>
        <p>Ta flotte est placée. La bataille commence dès que l'adversaire a placé la sienne.</p>
        <button type="button" className="link" onClick={onExit}>
          Quitter cette salle
        </button>
      </div>
    )
  }

  const bonuses = availableBonuses(state)

  return (
    <div className="bn-online-battle">
      {state.phase === 'over' && (
        <div className="card bn-over">
          <h2>{state.winnerSeat === state.mySeat ? 'Tu as gagné !' : "L'adversaire a gagné."}</h2>
          <button type="button" className="big" onClick={onExit}>
            Retour au menu
          </button>
          {ctx.isGuest && <p className="muted">Connecte-toi pour apparaître au classement.</p>}
        </div>
      )}
      {state.phase === 'battle' && (
        <div className="card bn-board">
          <h2>{state.turnSeat === state.mySeat ? 'À toi de tirer' : "Au tour de l'adversaire"}</h2>
          {state.lastEvent?.kind === 'fire' && (
            <p className={state.lastEvent.results.includes('hit') ? 'success' : 'muted'}>
              {describeFireEvent(state.lastEvent.by, state.lastEvent.results, state.lastEvent.sunk, state.mySeat)}
              {state.lastEvent.by === state.turnSeat && state.lastEvent.results.includes('hit') && ' Rejoue.'}
            </p>
          )}
          <div className="bn-boards">
            <div>
              <h3>Flotte adverse</h3>
              <FiringBoard
                label="Grille adverse"
                disabled={state.turnSeat !== state.mySeat}
                results={state.resultsOnOpponent}
                radarHints={state.radarRevealsOnOpponent}
                bonuses={bonuses}
                onFire={fire}
                onRadar={useRadar}
              />
            </div>
            <div>
              <h3>Ta flotte</h3>
              <OwnBoard fleet={myFleet} shotsOnMe={state.shotsOnMe} />
            </div>
            <StatusPanel
              myFleet={fleetStatus(myFleet, state.shotsOnMe)}
              opponentFleet={fleetStatusFromSunkNames(state.sunkOpponentShips)}
              shotsFired={state.shotsOnOpponent.size}
              hits={state.hitsOnOpponent}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default function BatailleNavaleGame({ ctx }: GameProps) {
  const [mode, setMode] = useState<Mode>(null)
  const [augmented, setAugmented] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])

  const refreshLeaderboard = useCallback(() => {
    ctx
      .getLeaderboard(10)
      .then(setLeaderboard)
      .catch((e) => setError((e as Error).message))
  }, [ctx])

  useEffect(() => {
    refreshLeaderboard()
  }, [refreshLeaderboard])

  // --- Mode local (passe-et-joue) ---------------------------------------------------------------
  const [localPhase, setLocalPhase] = useState<'placement' | 'battle' | 'over'>('placement')
  const [placingPlayer, setPlacingPlayer] = useState<Seat>(1)
  const [current, setCurrent] = useState<Seat>(1)
  const [winner, setWinner] = useState<Seat | null>(null)
  const [players, setPlayers] = useState<Record<Seat, PlayerState>>({ 1: emptyPlayerState(), 2: emptyPlayerState() })
  const [pass, setPass] = useState<{ message: string; onReady: () => void } | null>(null)
  const [lastShotMessage, setLastShotMessage] = useState<string | null>(null)

  function startLocal() {
    setMode('local')
    setLocalPhase('placement')
    setPlacingPlayer(1)
    setPlayers({ 1: emptyPlayerState(), 2: emptyPlayerState() })
    setCurrent(1)
    setWinner(null)
    setPass(null)
    setLastShotMessage(null)
    setError(null)
  }

  function completeLocalPlacement(fleet: PlacedShip[]) {
    setPlayers((prev) => ({ ...prev, [placingPlayer]: { ...emptyPlayerState(), fleet } }))
    if (placingPlayer === 1) {
      setPass({
        message: "Passe l'appareil au joueur 2 pour qu'il place sa flotte.",
        onReady: () => {
          setPass(null)
          setPlacingPlayer(2)
        },
      })
    } else {
      setPass({
        message: 'Passe l’appareil pour commencer la bataille.',
        onReady: () => {
          setPass(null)
          setLastShotMessage(null)
          setLocalPhase('battle')
        },
      })
    }
  }

  function passToNext(target: Seat, message: string) {
    setPass({
      message,
      onReady: () => {
        setPass(null)
        setLastShotMessage(null)
        setCurrent(target)
      },
    })
  }

  async function localFire(targets: Coord[], bonus?: 'salvo' | 'nuke') {
    const shooter = current
    const target: Seat = shooter === 1 ? 2 : 1
    const shots = new Set(players[shooter].shotsOnOpponent)
    try {
      const { outcomes, gameOver } = await fireVolleyAndSubmitIfOver(players[target].fleet, shots, targets, (score, metadata) =>
        ctx.submitScore(score, { ...metadata, winner: shooter }),
      )
      const resultsOnOpponent = new Map(players[shooter].resultsOnOpponent)
      let newHits = 0
      const sunkThisVolley: Ship[] = []
      for (const outcome of outcomes) {
        if (outcome.result !== 'repeat') resultsOnOpponent.set(coordKey(outcome.target), outcome.result)
        if (outcome.result === 'hit') newHits++
        if (outcome.sunk) sunkThisVolley.push(outcome.sunk)
      }
      setPlayers((prev) => ({
        ...prev,
        [shooter]: {
          ...prev[shooter],
          shotsOnOpponent: shots,
          resultsOnOpponent,
          hits: prev[shooter].hits + newHits,
          shipsSunk: prev[shooter].shipsSunk + sunkThisVolley.length,
          usedBonuses: bonus ? new Set(prev[shooter].usedBonuses).add(bonus) : prev[shooter].usedBonuses,
        },
      }))
      if (gameOver) {
        setWinner(shooter)
        setLocalPhase('over')
        refreshLeaderboard()
      } else if (newHits > 0) {
        // Un tir qui touche fait rejouer le même joueur : pas de passation, juste le résultat affiché.
        setLastShotMessage(describeOutcomes(outcomes))
      } else {
        passToNext(target, describeOutcomes(outcomes))
      }
    } catch (e) {
      setError((e as Error).message)
    }
  }

  function localRadar(zone: Coord[]) {
    const shooter = current
    const target: Seat = shooter === 1 ? 2 : 1
    const occupied = scanZone(players[target].fleet, zone)
    setPlayers((prev) => ({
      ...prev,
      [shooter]: {
        ...prev[shooter],
        radarRevealsOnOpponent: new Set([...prev[shooter].radarRevealsOnOpponent, ...occupied.map(coordKey)]),
        usedBonuses: new Set(prev[shooter].usedBonuses).add('radar'),
      },
    }))
    passToNext(
      target,
      occupied.length > 0 ? `Radar : ${occupied.length} case(s) occupée(s) détectée(s).` : 'Radar : rien détecté dans la zone.',
    )
  }

  // --- Mode en ligne ------------------------------------------------------------------------------
  const [onlineConnection, setOnlineConnection] = useState<RealtimeConnection | null>(null)
  const [onlineFleet, setOnlineFleet] = useState<PlacedShip[] | null>(null)
  const [joinCode, setJoinCode] = useState('')
  const [onlineBusy, setOnlineBusy] = useState(false)
  const [savedRoomCode, setSavedRoomCode] = useState<string | null>(null)

  function startOnline() {
    setMode('online')
    setOnlineConnection(null)
    setOnlineFleet(null)
    setJoinCode('')
    setError(null)
    setSavedRoomCode(loadSavedRoomCode())
  }

  async function createOnlineRoom() {
    setOnlineBusy(true)
    setError(null)
    try {
      const connection = await ctx.realtime.createRoom(2)
      saveRoomCode(connection.code)
      setOnlineConnection(connection)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setOnlineBusy(false)
    }
  }

  async function joinOnlineRoom(code: string) {
    setOnlineBusy(true)
    setError(null)
    try {
      const connection = await ctx.realtime.joinRoom(code)
      saveRoomCode(connection.code)
      setOnlineConnection(connection)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setOnlineBusy(false)
    }
  }

  async function closeSavedRoom() {
    if (!savedRoomCode) return
    setOnlineBusy(true)
    setError(null)
    try {
      const connection = await ctx.realtime.joinRoom(savedRoomCode)
      connection.close()
      forgetRoomCode()
      setSavedRoomCode(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setOnlineBusy(false)
    }
  }

  function exitOnline() {
    onlineConnection?.close()
    forgetRoomCode()
    setOnlineConnection(null)
    setOnlineFleet(null)
    setMode(null)
  }

  function backToMenu() {
    setMode(null)
    setError(null)
  }

  return (
    <div className="bataille-navale">
      {mode === null && (
        <div className="card bn-intro">
          <h2>Bataille navale</h2>
          <p>Coule la flotte adverse avant qu'elle ne coule la tienne.</p>
          <label className="bn-augmented-toggle">
            <input type="checkbox" checked={augmented} onChange={(e) => setAugmented(e.target.checked)} />
            Mode augmenté (salve, radar, frappe nucléaire)
          </label>
          <div className="bn-mode-choice">
            <button type="button" className="big" onClick={startLocal}>
              Solo (même appareil)
            </button>
            {ctx.isGuest ? (
              <p className="muted">Connecte-toi pour jouer en ligne contre un autre joueur.</p>
            ) : (
              <button type="button" className="big" onClick={startOnline}>
                En ligne
              </button>
            )}
          </div>
        </div>
      )}

      {mode === 'local' && pass && (
        <div className="card bn-pass">
          <h2>Passe l'appareil</h2>
          <p>{pass.message}</p>
          <button type="button" className="big" onClick={pass.onReady}>
            Je suis prêt
          </button>
        </div>
      )}

      {mode === 'local' && !pass && localPhase === 'placement' && (
        <div className="card">
          <h2>Le joueur {placingPlayer} place sa flotte</h2>
          <FleetPlacementBoard onComplete={completeLocalPlacement} />
        </div>
      )}

      {mode === 'local' && !pass && localPhase === 'battle' && (
        <div className="card bn-board">
          <h2>Au tour du joueur {current}</h2>
          {lastShotMessage && <p className="success">{lastShotMessage} Rejoue.</p>}
          <div className="bn-boards">
            <FiringBoard
              label={`Grille du joueur ${current === 1 ? 2 : 1}`}
              disabled={false}
              results={players[current].resultsOnOpponent}
              radarHints={players[current].radarRevealsOnOpponent}
              bonuses={
                augmented
                  ? unlockedBonuses(players[current].shotsOnOpponent.size, players[current].shipsSunk, players[current].usedBonuses)
                  : []
              }
              onFire={localFire}
              onRadar={localRadar}
            />
            <StatusPanel
              myFleet={fleetStatus(players[current].fleet, players[current === 1 ? 2 : 1].shotsOnOpponent)}
              opponentFleet={fleetStatus(players[current === 1 ? 2 : 1].fleet, players[current].shotsOnOpponent)}
              shotsFired={players[current].shotsOnOpponent.size}
              hits={players[current].hits}
            />
          </div>
          {error && <p className="error">{error}</p>}
        </div>
      )}

      {mode === 'local' && localPhase === 'over' && winner && (
        <div className="card bn-over">
          <h2>Le joueur {winner} a gagné !</h2>
          <button type="button" className="big" onClick={startLocal}>
            Rejouer
          </button>
          <button type="button" className="link" onClick={backToMenu}>
            Changer de mode
          </button>
          {ctx.isGuest && <p className="muted">Connecte-toi pour apparaître au classement.</p>}
        </div>
      )}

      {mode === 'online' && !onlineConnection && (
        <div className="card">
          <h2>Partie en ligne</h2>
          {savedRoomCode && (
            <div className="notice">
              <p>
                Tu as peut-être déjà une salle ouverte (code <strong>{savedRoomCode}</strong>). Une salle reste
                ouverte jusqu'à 1 h d'inactivité : il faut la rejoindre ou la fermer avant d'en créer une autre.
              </p>
              <div className="bn-mode-choice">
                <button type="button" className="small" disabled={onlineBusy} onClick={() => joinOnlineRoom(savedRoomCode)}>
                  Rejoindre cette salle
                </button>
                <button type="button" className="small" disabled={onlineBusy} onClick={closeSavedRoom}>
                  Fermer cette salle
                </button>
              </div>
            </div>
          )}
          <button type="button" className="big" disabled={onlineBusy} onClick={createOnlineRoom}>
            Créer une partie
          </button>
          <div className="divider">ou</div>
          <div className="form">
            <label htmlFor="bn-join-code">Code de la partie</label>
            <input id="bn-join-code" value={joinCode} onChange={(e) => setJoinCode(e.target.value)} />
            <button type="button" disabled={onlineBusy || !joinCode.trim()} onClick={() => joinOnlineRoom(joinCode.trim())}>
              Rejoindre
            </button>
          </div>
          <button type="button" className="link" onClick={backToMenu}>
            Changer de mode
          </button>
          {error && <p className="error">{error}</p>}
        </div>
      )}

      {mode === 'online' && onlineConnection && !onlineFleet && (
        <div className="card">
          <h2>Place ta flotte</h2>
          <p className="muted">
            Code de la partie : <strong>{onlineConnection.code}</strong> (partage-le pour inviter quelqu'un).
          </p>
          <FleetPlacementBoard onComplete={setOnlineFleet} />
          <button type="button" className="link" onClick={exitOnline}>
            Quitter cette salle
          </button>
        </div>
      )}

      {mode === 'online' && onlineConnection && onlineFleet && (
        <OnlineBattle
          connection={onlineConnection}
          myFleet={onlineFleet}
          augmented={augmented}
          ctx={ctx}
          onExit={exitOnline}
          onGameOver={refreshLeaderboard}
        />
      )}

      <div className="card">
        <h2>Classement</h2>
        <Leaderboard entries={leaderboard} currentUserId={ctx.player?.id} />
      </div>
    </div>
  )
}
