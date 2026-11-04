import {
  computeUnlocks,
  coordKey,
  fireVolley,
  isFleetSunk,
  scanZone,
  type Coord,
  type PlacedShip,
  type Ship,
  type ShotResult,
} from './logic'

/**
 * Cœur pur du mode en ligne : aucune donnée réseau n'entre ou ne sort autrement que par `outbox` (jamais
 * d'appel direct à `RealtimeConnection.send` ici). Protocole décentralisé : chaque flotte ne quitte jamais le
 * navigateur de son propriétaire, et seul le joueur visé par un tir (lui seul connaît sa flotte) calcule et
 * diffuse le résultat. Un `send` du socle est rediffusé à toute la salle, y compris à son propre expéditeur :
 * `FIRE`/`RADAR` ignorent donc l'écho de leur propre envoi (seul le joueur visé doit réagir), alors que
 * `FIRE_RESULT`/`RADAR_RESULT`/`READY` s'appliquent pareil des deux côtés, écho compris.
 */

export type NetPhase = 'placement' | 'battle' | 'over'
export type Bonus = 'salvo' | 'radar' | 'nuke'

export type NetLastEvent =
  | { kind: 'fire'; by: number; targets: Coord[]; results: ShotResult[]; sunk: Ship[] }
  | { kind: 'radar'; by: number; zone: Coord[]; occupied: Coord[] }
  | null

export type NetState = {
  readonly phase: NetPhase
  readonly mySeat: number
  readonly turnSeat: number
  readonly readySeats: ReadonlySet<number>
  readonly myFleet: PlacedShip[]
  /** Cases où l'adversaire a tiré sur moi. */
  readonly shotsOnMe: ReadonlySet<string>
  /** Cases où j'ai tiré sur l'adversaire. */
  readonly shotsOnOpponent: ReadonlySet<string>
  /** Résultat de chaque case de `shotsOnOpponent` (pour l'affichage : touché/à l'eau). */
  readonly resultsOnOpponent: ReadonlyMap<string, 'hit' | 'miss'>
  /** Cases adverses révélées occupées par un radar, jamais marquées comme tirées. */
  readonly radarRevealsOnOpponent: ReadonlySet<string>
  readonly hitsOnOpponent: number
  readonly shipsSunkByMe: number
  /** Noms des navires adverses coulés (la composition de FLEET est publique, seul leur placement est secret). */
  readonly sunkOpponentShips: ReadonlySet<string>
  readonly usedBonuses: ReadonlySet<Bonus>
  readonly augmented: boolean
  readonly winnerSeat: number | null
  readonly disconnected: boolean
  readonly pendingSubmit: { shots: number; hits: number } | null
  readonly lastEvent: NetLastEvent
}

export function createNetState(mySeat: number, myFleet: PlacedShip[], augmented: boolean): NetState {
  return {
    phase: 'placement',
    mySeat,
    turnSeat: 1,
    readySeats: new Set(),
    myFleet,
    shotsOnMe: new Set(),
    shotsOnOpponent: new Set(),
    resultsOnOpponent: new Map(),
    radarRevealsOnOpponent: new Set(),
    hitsOnOpponent: 0,
    shipsSunkByMe: 0,
    sunkOpponentShips: new Set(),
    usedBonuses: new Set(),
    augmented,
    winnerSeat: null,
    disconnected: false,
    pendingSubmit: null,
    lastEvent: null,
  }
}

/** Bonus débloqués par mes propres tirs/navires coulés, pas encore utilisés : seuls ceux-ci sont jouables. */
export function availableBonuses(state: NetState): Bonus[] {
  if (!state.augmented) return []
  const unlocks = computeUnlocks(state.shotsOnOpponent.size, state.shipsSunkByMe)
  return (['salvo', 'radar', 'nuke'] as const).filter((b) => unlocks[b] && !state.usedBonuses.has(b))
}

function otherSeat(seat: number): number {
  return seat === 1 ? 2 : 1
}

export type LocalIntent =
  | { kind: 'READY' }
  | { kind: 'FIRE'; targets: Coord[]; bonus?: 'salvo' | 'nuke' }
  | { kind: 'RADAR'; zone: Coord[] }

export type OutgoingEvent = { type: string; data: unknown }

type FirePayload = { by: number; targets: Coord[] }
type FireResultPayload = { by: number; targets: Coord[]; results: ShotResult[]; sunk: Ship[]; gameOver: boolean }
type RadarPayload = { by: number; zone: Coord[] }
type RadarResultPayload = { by: number; zone: Coord[]; occupied: Coord[] }

export type RemoteEvent =
  | { type: 'READY'; payload: { by: number } }
  | { type: 'FIRE'; payload: FirePayload }
  | { type: 'FIRE_RESULT'; payload: FireResultPayload }
  | { type: 'RADAR'; payload: RadarPayload }
  | { type: 'RADAR_RESULT'; payload: RadarResultPayload }
  | { type: 'PLAYER_LEFT'; payload: unknown }
  | { type: 'GAME_ABANDONED'; payload: unknown }

type Transition = { state: NetState; outbox: OutgoingEvent[] }

/** Une intention locale (mon clic) : jamais de mutation d'état décisive ici hors marquage d'un bonus utilisé. */
export function applyLocalIntent(state: NetState, intent: LocalIntent): Transition {
  const myTurn = state.phase === 'battle' && state.turnSeat === state.mySeat
  switch (intent.kind) {
    case 'READY':
      if (state.phase !== 'placement') return { state, outbox: [] }
      return { state, outbox: [{ type: 'READY', data: { by: state.mySeat } }] }

    case 'FIRE': {
      if (!myTurn) return { state, outbox: [] }
      const usedBonuses = intent.bonus ? new Set(state.usedBonuses).add(intent.bonus) : state.usedBonuses
      return {
        state: { ...state, usedBonuses },
        outbox: [{ type: 'FIRE', data: { by: state.mySeat, targets: intent.targets } satisfies FirePayload }],
      }
    }

    case 'RADAR': {
      if (!myTurn) return { state, outbox: [] }
      return {
        state: { ...state, usedBonuses: new Set(state.usedBonuses).add('radar') },
        outbox: [{ type: 'RADAR', data: { by: state.mySeat, zone: intent.zone } satisfies RadarPayload }],
      }
    }
  }
}

/** Un évènement public reçu du socle (le mien compris : voir le commentaire d'en-tête). */
export function applyRemoteEvent(state: NetState, event: RemoteEvent): Transition {
  switch (event.type) {
    case 'READY': {
      if (state.phase !== 'placement') {
        // L'adversaire annonce qu'il est prêt alors que la bataille est déjà en cours ou terminée chez
        // moi : son client est reparti de zéro (page rechargée). Aucune reprise n'est prise en charge
        // (voir l'en-tête) : cette partie ne peut plus continuer, des deux côtés.
        return { state: { ...state, disconnected: true }, outbox: [{ type: 'GAME_ABANDONED', data: null }] }
      }
      const readySeats = new Set(state.readySeats).add(event.payload.by)
      const reachesBattle = readySeats.size >= 2 && state.readySeats.size < 2
      // Le socle ne rediffuse qu'aux comptes déjà abonnés, sans historique : si mon propre premier READY
      // est parti avant que l'adversaire n'ait rejoint la salle, il est perdu pour toujours de son côté.
      // Dès que CE message me fait passer à deux sièges prêts, je sais que l'adversaire vient de m'envoyer
      // le sien à l'instant (donc qu'il est bien abonné) : je renvoie le mien une dernière fois, pour qu'il
      // le reçoive même s'il avait raté le tout premier envoi. Sans condition de délai ni de répétition en
      // boucle : une seule confirmation, exactement quand elle sert, jamais après coup.
      const outbox: OutgoingEvent[] = reachesBattle ? [{ type: 'READY', data: { by: state.mySeat } }] : []
      const phase = readySeats.size >= 2 ? 'battle' : state.phase
      return { state: { ...state, readySeats, phase }, outbox }
    }

    case 'FIRE': {
      if (event.payload.by === state.mySeat) return { state, outbox: [] } // écho de mon propre tir : rien à faire
      const shots = new Set(state.shotsOnMe)
      const outcomes = fireVolley(state.myFleet, shots, event.payload.targets)
      const sunk = outcomes.flatMap((o) => (o.sunk ? [o.sunk] : []))
      const gameOver = isFleetSunk(state.myFleet, shots)
      const result: FireResultPayload = {
        by: event.payload.by,
        targets: event.payload.targets,
        results: outcomes.map((o) => o.result),
        sunk,
        gameOver,
      }
      return { state, outbox: [{ type: 'FIRE_RESULT', data: result }] }
    }

    case 'FIRE_RESULT': {
      const { by, targets, results, sunk, gameOver } = event.payload
      const iAmShooter = by === state.mySeat
      const shots = new Set(iAmShooter ? state.shotsOnOpponent : state.shotsOnMe)
      for (const t of targets) shots.add(coordKey(t))
      const hitsOnOpponent = iAmShooter
        ? state.hitsOnOpponent + results.filter((r) => r === 'hit').length
        : state.hitsOnOpponent
      const shipsSunkByMe = iAmShooter ? state.shipsSunkByMe + sunk.length : state.shipsSunkByMe
      const resultsOnOpponent = new Map(state.resultsOnOpponent)
      if (iAmShooter) {
        targets.forEach((t, i) => {
          if (results[i] !== 'repeat') resultsOnOpponent.set(coordKey(t), results[i] as 'hit' | 'miss')
        })
      }
      const sunkOpponentShips = iAmShooter
        ? new Set([...state.sunkOpponentShips, ...sunk.map((s) => s.name)])
        : state.sunkOpponentShips
      const next: NetState = {
        ...state,
        shotsOnOpponent: iAmShooter ? shots : state.shotsOnOpponent,
        resultsOnOpponent,
        shotsOnMe: iAmShooter ? state.shotsOnMe : shots,
        hitsOnOpponent,
        shipsSunkByMe,
        sunkOpponentShips,
        turnSeat: gameOver ? state.turnSeat : otherSeat(by),
        phase: gameOver ? 'over' : state.phase,
        winnerSeat: gameOver ? by : state.winnerSeat,
        pendingSubmit: gameOver && iAmShooter ? { shots: shots.size, hits: hitsOnOpponent } : state.pendingSubmit,
        lastEvent: { kind: 'fire', by, targets, results, sunk },
      }
      return { state: next, outbox: [] }
    }

    case 'RADAR': {
      if (event.payload.by === state.mySeat) return { state, outbox: [] } // écho de mon propre radar
      const occupied = scanZone(state.myFleet, event.payload.zone)
      const result: RadarResultPayload = { by: event.payload.by, zone: event.payload.zone, occupied }
      return { state, outbox: [{ type: 'RADAR_RESULT', data: result }] }
    }

    case 'RADAR_RESULT': {
      const { by, zone, occupied } = event.payload
      const iAmShooter = by === state.mySeat
      const radarRevealsOnOpponent = new Set(state.radarRevealsOnOpponent)
      if (iAmShooter) for (const c of occupied) radarRevealsOnOpponent.add(coordKey(c))
      return {
        state: {
          ...state,
          radarRevealsOnOpponent,
          turnSeat: otherSeat(by),
          lastEvent: { kind: 'radar', by, zone, occupied },
        },
        outbox: [],
      }
    }

    case 'PLAYER_LEFT':
    case 'GAME_ABANDONED':
      return { state: { ...state, disconnected: true }, outbox: [] }
  }
}
