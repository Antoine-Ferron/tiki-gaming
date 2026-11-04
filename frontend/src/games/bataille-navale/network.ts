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
  /** Sièges dont le RADAR_RESULT a déjà été appliqué (la main déjà passée) : une redélivrance ne la repasse pas. */
  readonly radarResolvedBy: ReadonlySet<number>
  readonly hitsOnOpponent: number
  readonly shipsSunkByMe: number
  /** Noms des navires adverses coulés (la composition de FLEET est publique, seul leur placement est secret). */
  readonly sunkOpponentShips: ReadonlySet<string>
  readonly usedBonuses: ReadonlySet<Bonus>
  readonly augmented: boolean
  /** Un tir/radar est parti, sa réponse pas encore reçue : bloque un second envoi avant la fin de l'aller-retour. */
  readonly awaitingResult: boolean
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
    radarResolvedBy: new Set(),
    hitsOnOpponent: 0,
    shipsSunkByMe: 0,
    sunkOpponentShips: new Set(),
    usedBonuses: new Set(),
    augmented,
    awaitingResult: false,
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

/** Forme sérialisable de `NetState` (JSON ne sait pas écrire un `Set`/`Map`) : voir `serializeNetState`. */
export type SerializedNetState = {
  phase: NetPhase
  mySeat: number
  turnSeat: number
  readySeats: number[]
  myFleet: PlacedShip[]
  shotsOnMe: string[]
  shotsOnOpponent: string[]
  resultsOnOpponent: [string, 'hit' | 'miss'][]
  radarRevealsOnOpponent: string[]
  radarResolvedBy: number[]
  hitsOnOpponent: number
  shipsSunkByMe: number
  sunkOpponentShips: string[]
  usedBonuses: Bonus[]
  augmented: boolean
  awaitingResult: boolean
  winnerSeat: number | null
  disconnected: boolean
  pendingSubmit: { shots: number; hits: number } | null
  lastEvent: NetLastEvent
}

/**
 * Pour la reprise après rechargement (voir `useNetGame`) : persister `NetState` tel quel sur `localStorage`
 * est impossible (`Set`/`Map` ne survivent pas à `JSON.stringify`). Les champs idempotents (Set/Map) sont la
 * seule source de vérité au retour ; aucun compteur dérivé n'a besoin d'un traitement spécial ici puisqu'il
 * est déjà recalculé depuis eux (voir le cas `FIRE_RESULT` plus haut).
 */
export function serializeNetState(state: NetState): SerializedNetState {
  return {
    phase: state.phase,
    mySeat: state.mySeat,
    turnSeat: state.turnSeat,
    readySeats: [...state.readySeats],
    myFleet: state.myFleet,
    shotsOnMe: [...state.shotsOnMe],
    shotsOnOpponent: [...state.shotsOnOpponent],
    resultsOnOpponent: [...state.resultsOnOpponent],
    radarRevealsOnOpponent: [...state.radarRevealsOnOpponent],
    radarResolvedBy: [...state.radarResolvedBy],
    hitsOnOpponent: state.hitsOnOpponent,
    shipsSunkByMe: state.shipsSunkByMe,
    sunkOpponentShips: [...state.sunkOpponentShips],
    usedBonuses: [...state.usedBonuses],
    augmented: state.augmented,
    awaitingResult: state.awaitingResult,
    winnerSeat: state.winnerSeat,
    disconnected: state.disconnected,
    pendingSubmit: state.pendingSubmit,
    lastEvent: state.lastEvent,
  }
}

export function deserializeNetState(s: SerializedNetState): NetState {
  return {
    phase: s.phase,
    mySeat: s.mySeat,
    turnSeat: s.turnSeat,
    readySeats: new Set(s.readySeats),
    myFleet: s.myFleet,
    shotsOnMe: new Set(s.shotsOnMe),
    shotsOnOpponent: new Set(s.shotsOnOpponent),
    resultsOnOpponent: new Map(s.resultsOnOpponent),
    radarRevealsOnOpponent: new Set(s.radarRevealsOnOpponent),
    radarResolvedBy: new Set(s.radarResolvedBy),
    hitsOnOpponent: s.hitsOnOpponent,
    shipsSunkByMe: s.shipsSunkByMe,
    sunkOpponentShips: new Set(s.sunkOpponentShips),
    usedBonuses: new Set(s.usedBonuses),
    augmented: s.augmented,
    awaitingResult: s.awaitingResult,
    winnerSeat: s.winnerSeat,
    disconnected: s.disconnected,
    pendingSubmit: s.pendingSubmit,
    lastEvent: s.lastEvent,
  }
}

function otherSeat(seat: number): number {
  return seat === 1 ? 2 : 1
}

export type LocalIntent =
  { kind: 'READY' } | { kind: 'FIRE'; targets: Coord[]; bonus?: 'salvo' | 'nuke' } | { kind: 'RADAR'; zone: Coord[] }

export type OutgoingEvent = { type: string; data: unknown; actionId: string }

type FirePayload = { by: number; targets: Coord[] }
type FireResultPayload = { by: number; targets: Coord[]; results: ShotResult[]; sunk: Ship[]; gameOver: boolean }
type RadarPayload = { by: number; zone: Coord[] }
type RadarResultPayload = { by: number; zone: Coord[]; occupied: Coord[] }

type ReadyPayload = { by: number; confirm?: boolean; augmented?: boolean }

export type RemoteEvent =
  | { type: 'READY'; payload: ReadyPayload }
  | { type: 'FIRE'; payload: FirePayload }
  | { type: 'FIRE_RESULT'; payload: FireResultPayload }
  | { type: 'RADAR'; payload: RadarPayload }
  | { type: 'RADAR_RESULT'; payload: RadarResultPayload }
  | { type: 'PLAYER_LEFT'; payload: unknown }
  | { type: 'GAME_ABANDONED'; payload: unknown }

type Transition = { state: NetState; outbox: OutgoingEvent[] }

/**
 * Identifiant stable d'une action : `RealtimeConnection.send` le réutilise tel quel pour qu'une retentative
 * (double-envoi de <StrictMode>, redélivrance réseau) soit ignorée côté serveur plutôt que rejouée. Dérivé du
 * contenu de l'action elle-même : deux appels identiques (même siège, même tour, mêmes cases) produisent donc
 * toujours le même identifiant, et une action réellement différente (tour suivant, autres cases) un autre.
 */
function actionId(...parts: (string | number)[]): string {
  return parts.join(':')
}

/** Une intention locale (mon clic) : jamais de mutation d'état décisive ici hors marquage d'un bonus utilisé. */
export function applyLocalIntent(state: NetState, intent: LocalIntent): Transition {
  const myTurn = state.phase === 'battle' && state.turnSeat === state.mySeat && !state.awaitingResult
  switch (intent.kind) {
    case 'READY':
      if (state.phase !== 'placement') return { state, outbox: [] }
      return {
        state,
        outbox: [
          {
            type: 'READY',
            data: { by: state.mySeat, augmented: state.augmented } satisfies ReadyPayload,
            actionId: actionId('ready', state.mySeat),
          },
        ],
      }

    case 'FIRE': {
      if (!myTurn) return { state, outbox: [] }
      const usedBonuses = intent.bonus ? new Set(state.usedBonuses).add(intent.bonus) : state.usedBonuses
      const id = actionId('fire', state.mySeat, state.turnSeat, intent.targets.map(coordKey).join('|'))
      return {
        state: { ...state, usedBonuses, awaitingResult: true },
        outbox: [
          { type: 'FIRE', data: { by: state.mySeat, targets: intent.targets } satisfies FirePayload, actionId: id },
        ],
      }
    }

    case 'RADAR': {
      if (!myTurn) return { state, outbox: [] }
      const id = actionId('radar', state.mySeat, state.turnSeat, intent.zone.map(coordKey).join('|'))
      return {
        state: { ...state, usedBonuses: new Set(state.usedBonuses).add('radar'), awaitingResult: true },
        outbox: [{ type: 'RADAR', data: { by: state.mySeat, zone: intent.zone } satisfies RadarPayload, actionId: id }],
      }
    }
  }
}

/** Un évènement public reçu du socle (le mien compris : voir le commentaire d'en-tête). */
export function applyRemoteEvent(state: NetState, event: RemoteEvent): Transition {
  switch (event.type) {
    case 'READY': {
      if (state.phase !== 'placement') {
        // Mon propre écho (le mien ou la confirmation que je viens de déclencher, voir plus bas) : rien
        // d'anormal, on l'ignore. Seul un READY qui n'est ni le mien ni une confirmation attendue signale
        // que l'adversaire est reparti de zéro (page rechargée) : aucune reprise n'est prise en charge
        // (voir l'en-tête), cette partie ne peut plus continuer, des deux côtés.
        if (event.payload.by === state.mySeat || event.payload.confirm) return { state, outbox: [] }
        return {
          state: { ...state, disconnected: true },
          outbox: [{ type: 'GAME_ABANDONED', data: null, actionId: actionId('abandoned', state.mySeat) }],
        }
      }
      const readySeats = new Set(state.readySeats).add(event.payload.by)
      const reachesBattle = readySeats.size >= 2 && state.readySeats.size < 2
      // Le socle ne rediffuse qu'aux comptes déjà abonnés, sans historique : si mon propre premier READY
      // est parti avant que l'adversaire n'ait rejoint la salle, il est perdu pour toujours de son côté.
      // Dès que CE message me fait passer à deux sièges prêts, je sais que l'adversaire vient de m'envoyer
      // le sien à l'instant (donc qu'il est bien abonné) : je renvoie le mien une dernière fois, marqué
      // `confirm`, pour qu'il le reçoive même s'il avait raté le tout premier envoi — sans que cette
      // confirmation (qui arrive forcément après que j'ai déjà basculé en bataille) ne soit prise pour un
      // signal d'abandon par qui la reçoit. Sans condition de délai ni de répétition en boucle : une seule
      // confirmation, exactement quand elle sert, jamais après coup.
      const outbox: OutgoingEvent[] = reachesBattle
        ? [
            {
              type: 'READY',
              data: { by: state.mySeat, confirm: true, augmented: state.augmented } satisfies ReadyPayload,
              actionId: actionId('ready-confirm', state.mySeat),
            },
          ]
        : []
      const phase = readySeats.size >= 2 ? 'battle' : state.phase
      // Siège 1 (créateur de la salle) fait autorité sur le mode augmenté : sans ça, chacun garde sa propre
      // case à cocher, et un camp peut se retrouver avec des bonus que l'autre n'a jamais acceptés.
      const augmented =
        event.payload.by === 1 && event.payload.augmented !== undefined ? event.payload.augmented : state.augmented
      return { state: { ...state, readySeats, phase, augmented }, outbox }
    }

    case 'FIRE': {
      if (event.payload.by === state.mySeat) return { state, outbox: [] } // écho de mon propre tir : rien à faire
      // Un FIRE ne peut légitimement arriver qu'une fois les deux camps en bataille ; un message reçu hors de
      // cette phase (reconnexion manquée, évènement hors ordre) ne doit pas être calculé contre ma flotte.
      if (state.phase !== 'battle') return { state, outbox: [] }
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
      const id = actionId('fire-result', state.mySeat, event.payload.by, event.payload.targets.map(coordKey).join('|'))
      return { state, outbox: [{ type: 'FIRE_RESULT', data: result, actionId: id }] }
    }

    case 'FIRE_RESULT': {
      const { by, targets, results, sunk, gameOver } = event.payload
      // Pure redélivrance (StrictMode rejoue exprès les mises à jour d'état impures en développement, voir
      // le commentaire de `dispatchLocal` dans useNetGame.ts — et une redélivrance réseau peut faire pareil
      // en production) : chaque case qu'elle vise a déjà été traitée, donc `repeat` partout. La laisser passer
      // ferait à tort passer la main sur un tir qui, la première fois, avait touché (`results.includes('hit')`
      // devient faux pour sa seconde copie) : on l'ignore entièrement, sans toucher au tour ni à rien d'autre.
      if (results.every((r) => r === 'repeat')) return { state, outbox: [] }
      const iAmShooter = by === state.mySeat
      const shots = new Set(iAmShooter ? state.shotsOnOpponent : state.shotsOnMe)
      for (const t of targets) shots.add(coordKey(t))
      const resultsOnOpponent = new Map(state.resultsOnOpponent)
      if (iAmShooter) {
        targets.forEach((t, i) => {
          if (results[i] !== 'repeat') resultsOnOpponent.set(coordKey(t), results[i] as 'hit' | 'miss')
        })
      }
      const sunkOpponentShips = iAmShooter
        ? new Set([...state.sunkOpponentShips, ...sunk.map((s) => s.name)])
        : state.sunkOpponentShips
      // Dérivés de `resultsOnOpponent`/`sunkOpponentShips` (idempotents, par case/par nom), jamais d'un compteur
      // qu'on incrémente : le socle rediffuse à toute la salle y compris son propre expéditeur, et une
      // redélivrance (reconnexion STOMP, etc.) ne doit pas compter deux fois le même tir.
      const hitsOnOpponent = iAmShooter
        ? [...resultsOnOpponent.values()].filter((r) => r === 'hit').length
        : state.hitsOnOpponent
      const shipsSunkByMe = iAmShooter ? sunkOpponentShips.size : state.shipsSunkByMe
      // Un tir qui touche fait rejouer le même camp ; seul un tir entièrement à l'eau passe la main.
      const anyHit = results.includes('hit')
      const next: NetState = {
        ...state,
        shotsOnOpponent: iAmShooter ? shots : state.shotsOnOpponent,
        resultsOnOpponent,
        shotsOnMe: iAmShooter ? state.shotsOnMe : shots,
        hitsOnOpponent,
        shipsSunkByMe,
        sunkOpponentShips,
        turnSeat: gameOver ? state.turnSeat : anyHit ? by : otherSeat(by),
        phase: gameOver ? 'over' : state.phase,
        winnerSeat: gameOver ? by : state.winnerSeat,
        awaitingResult: iAmShooter ? false : state.awaitingResult,
        pendingSubmit: gameOver && iAmShooter ? { shots: shots.size, hits: hitsOnOpponent } : state.pendingSubmit,
        lastEvent: { kind: 'fire', by, targets, results, sunk },
      }
      return { state: next, outbox: [] }
    }

    case 'RADAR': {
      if (event.payload.by === state.mySeat) return { state, outbox: [] } // écho de mon propre radar
      if (state.phase !== 'battle') return { state, outbox: [] }
      const occupied = scanZone(state.myFleet, event.payload.zone)
      const result: RadarResultPayload = { by: event.payload.by, zone: event.payload.zone, occupied }
      const id = actionId('radar-result', state.mySeat, event.payload.by, event.payload.zone.map(coordKey).join('|'))
      return { state, outbox: [{ type: 'RADAR_RESULT', data: result, actionId: id }] }
    }

    case 'RADAR_RESULT': {
      const { by, zone, occupied } = event.payload
      // Radar est un bonus à usage unique par siège (voir `computeUnlocks`/`usedBonuses`) : au plus un
      // RADAR_RESULT par `by` sur toute la partie. Une redélivrance (StrictMode, reconnexion) du même message
      // ne doit donc pas repasser la main une seconde fois — contrairement à `state.turnSeat`, qui peut être
      // revenu entre-temps à `by` après un tour complet de l'adversaire, ce marqueur ne peut pas y rejouer.
      if (state.radarResolvedBy.has(by)) return { state, outbox: [] }
      const iAmShooter = by === state.mySeat
      const radarRevealsOnOpponent = new Set(state.radarRevealsOnOpponent)
      if (iAmShooter) for (const c of occupied) radarRevealsOnOpponent.add(coordKey(c))
      return {
        state: {
          ...state,
          radarRevealsOnOpponent,
          radarResolvedBy: new Set(state.radarResolvedBy).add(by),
          turnSeat: otherSeat(by),
          awaitingResult: iAmShooter ? false : state.awaitingResult,
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
