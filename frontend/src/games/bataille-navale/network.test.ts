import { describe, expect, it } from 'vitest'
import { coordKey, shipCoords, type Coord, type PlacedShip } from './logic'
import {
  applyLocalIntent,
  applyRemoteEvent,
  availableBonuses,
  createNetState,
  deserializeNetState,
  serializeNetState,
  type NetState,
  type RemoteEvent,
} from './network'

/** Torpilleur (taille 2) en (0,0)-(0,1) : assez pour tester touché/coulé sans détailler toute la flotte. */
function fleetAt(start: Coord): PlacedShip[] {
  return [{ ship: { name: 'Torpilleur', size: 2 }, coords: shipCoords(start, 2, 'horizontal') }]
}

const myFleet = fleetAt({ row: 0, col: 0 })

describe('createNetState', () => {
  it('starts in placement, seat 1 to begin, nothing fired yet', () => {
    const state = createNetState(1, myFleet, false)
    expect(state.phase).toBe('placement')
    expect(state.turnSeat).toBe(1)
    expect(state.readySeats.size).toBe(0)
    expect(state.winnerSeat).toBeNull()
  })
})

describe('READY handshake', () => {
  it('sends my own READY without touching readySeats yet', () => {
    const state = createNetState(1, myFleet, false)
    const { state: next, outbox } = applyLocalIntent(state, { kind: 'READY' })
    expect(outbox).toEqual([{ type: 'READY', data: { by: 1 } }])
    expect(next.readySeats.size).toBe(0)
  })

  it('moves to battle once both seats have sent READY (mine included, as an echo)', () => {
    let state = createNetState(1, myFleet, false)
    state = applyRemoteEvent(state, { type: 'READY', payload: { by: 1 } }).state
    expect(state.phase).toBe('placement')
    const { state: next, outbox } = applyRemoteEvent(state, { type: 'READY', payload: { by: 2 } })
    expect(next.phase).toBe('battle')
    // Confirmation envoyée à l'instant où je découvre que les deux sièges sont prêts : voir le test
    // « late-joining » dans useNetGame.test.tsx pour la raison d'être de cette confirmation.
    expect(outbox).toEqual([{ type: 'READY', data: { by: 1, confirm: true } }])
  })

  it('does nothing once placement is already done', () => {
    const state = createNetState(1, myFleet, false)
    const { outbox } = applyLocalIntent({ ...state, phase: 'battle' }, { kind: 'READY' })
    expect(outbox).toEqual([])
  })
})

function battleState(overrides: Partial<NetState> = {}): NetState {
  return { ...createNetState(1, myFleet, false), phase: 'battle', ...overrides }
}

describe('FIRE — echo of my own shot is ignored', () => {
  it('produces no outbox and no state change when I receive my own FIRE back', () => {
    const state = battleState()
    const { state: next, outbox } = applyRemoteEvent(state, {
      type: 'FIRE',
      payload: { by: 1, targets: [{ row: 0, col: 0 }] },
    })
    expect(outbox).toEqual([])
    expect(next).toBe(state)
  })
})

describe('FIRE — I am the target, I compute and reply', () => {
  it('replies with a miss for an empty cell, without ending the game', () => {
    const state = battleState()
    const { outbox } = applyRemoteEvent(state, { type: 'FIRE', payload: { by: 2, targets: [{ row: 5, col: 5 }] } })
    expect(outbox).toEqual([
      { type: 'FIRE_RESULT', data: { by: 2, targets: [{ row: 5, col: 5 }], results: ['miss'], sunk: [], gameOver: false } },
    ])
  })

  it('replies with a hit and sunk ship once every one of its cells is targeted', () => {
    const state = battleState({ shotsOnMe: new Set([coordKey({ row: 0, col: 0 })]) })
    const { outbox } = applyRemoteEvent(state, { type: 'FIRE', payload: { by: 2, targets: [{ row: 0, col: 1 }] } })
    const [event] = outbox
    expect(event.data).toMatchObject({ results: ['hit'], sunk: [myFleet[0].ship], gameOver: true })
  })

  it('does not mutate shotsOnMe directly: the state only changes once FIRE_RESULT is applied', () => {
    const state = battleState()
    const { state: next } = applyRemoteEvent(state, { type: 'FIRE', payload: { by: 2, targets: [{ row: 0, col: 0 }] } })
    expect(next.shotsOnMe.size).toBe(0)
  })
})

describe('FIRE_RESULT — applied identically by both sides', () => {
  it('as the shooter: records the hit on my view of the opponent, and keeps my turn (a hit plays again)', () => {
    const state = battleState({ turnSeat: 1 })
    const event: RemoteEvent = {
      type: 'FIRE_RESULT',
      payload: { by: 1, targets: [{ row: 3, col: 3 }], results: ['hit'], sunk: [], gameOver: false },
    }
    const { state: next } = applyRemoteEvent(state, event)
    expect(next.shotsOnOpponent.has(coordKey({ row: 3, col: 3 }))).toBe(true)
    expect(next.hitsOnOpponent).toBe(1)
    expect(next.turnSeat).toBe(1)
    expect(next.shotsOnMe.size).toBe(0)
  })

  it('as the target (my own echo of the result I computed): records it on my own board, turn stays with the shooter', () => {
    const state = battleState({ turnSeat: 2 })
    const event: RemoteEvent = {
      type: 'FIRE_RESULT',
      payload: { by: 2, targets: [{ row: 0, col: 0 }], results: ['hit'], sunk: [], gameOver: false },
    }
    const { state: next } = applyRemoteEvent(state, event)
    expect(next.shotsOnMe.has(coordKey({ row: 0, col: 0 }))).toBe(true)
    expect(next.shotsOnOpponent.size).toBe(0)
    expect(next.hitsOnOpponent).toBe(0) // ce n'est pas moi qui ai tiré : mon compteur de touches ne bouge pas
    expect(next.turnSeat).toBe(2)
  })

  it('passes the turn to the other seat only when the shot entirely misses', () => {
    const state = battleState({ turnSeat: 1 })
    const event: RemoteEvent = {
      type: 'FIRE_RESULT',
      payload: { by: 1, targets: [{ row: 9, col: 9 }], results: ['miss'], sunk: [], gameOver: false },
    }
    const { state: next } = applyRemoteEvent(state, event)
    expect(next.turnSeat).toBe(2)
  })

  it('keeps the turn after a volley with at least one hit, even if some cells missed', () => {
    const state = battleState({ turnSeat: 1 })
    const event: RemoteEvent = {
      type: 'FIRE_RESULT',
      payload: {
        by: 1,
        targets: [{ row: 3, col: 3 }, { row: 9, col: 9 }],
        results: ['hit', 'miss'],
        sunk: [],
        gameOver: false,
      },
    }
    const { state: next } = applyRemoteEvent(state, event)
    expect(next.turnSeat).toBe(1)
  })

  it('ignores a redelivered FIRE_RESULT whose cells are now all "repeat": does not steal the replay back', () => {
    // Bug réel : <StrictMode> rejoue la fonction de mise à jour passée à `setState` (côté `dispatchLocal`
    // ET côté le gestionnaire d'évènements distants de useNetGame.ts), ce qui envoie deux fois le même
    // FIRE/FIRE_RESULT sur le réseau. La première copie touche (`results: ['hit']`, on garde la main) ; la
    // seconde arrive pour une case déjà marquée tirée, donc `results: ['repeat']` — sans ce garde-fou,
    // `anyHit` redevient faux pour cette seconde copie et fait passer la main à tort, juste après un tir
    // qui aurait dû faire rejouer.
    const state = battleState({ turnSeat: 1 })
    const hit: RemoteEvent = {
      type: 'FIRE_RESULT',
      payload: { by: 1, targets: [{ row: 3, col: 3 }], results: ['hit'], sunk: [], gameOver: false },
    }
    const afterHit = applyRemoteEvent(state, hit).state
    expect(afterHit.turnSeat).toBe(1)

    const redelivered: RemoteEvent = {
      type: 'FIRE_RESULT',
      payload: { by: 1, targets: [{ row: 3, col: 3 }], results: ['repeat'], sunk: [], gameOver: false },
    }
    const { state: next, outbox } = applyRemoteEvent(afterHit, redelivered)
    expect(next).toBe(afterHit) // no-op complet, pas seulement un tour inchangé
    expect(outbox).toEqual([])
  })

  it('ends the game and queues a score submission only for the winning shooter', () => {
    const state = battleState({
      turnSeat: 1,
      shotsOnOpponent: new Set([coordKey({ row: 1, col: 1 })]),
      resultsOnOpponent: new Map([[coordKey({ row: 1, col: 1 }), 'hit']]),
    })
    const event: RemoteEvent = {
      type: 'FIRE_RESULT',
      payload: { by: 1, targets: [{ row: 2, col: 2 }], results: ['hit'], sunk: [myFleet[0].ship], gameOver: true },
    }
    const { state: next } = applyRemoteEvent(state, event)
    expect(next.phase).toBe('over')
    expect(next.winnerSeat).toBe(1)
    expect(next.shipsSunkByMe).toBe(1)
    expect(next.pendingSubmit).toEqual({ shots: 2, hits: 2 })
    expect(next.sunkOpponentShips.has(myFleet[0].ship.name)).toBe(true)
  })

  it('only records a sunk opponent ship when I am the one who sank it', () => {
    const state = battleState({ turnSeat: 2 })
    const event: RemoteEvent = {
      type: 'FIRE_RESULT',
      payload: { by: 2, targets: [{ row: 0, col: 1 }], results: ['hit'], sunk: [myFleet[0].ship], gameOver: true },
    }
    const { state: next } = applyRemoteEvent(state, event)
    expect(next.sunkOpponentShips.size).toBe(0)
  })

  it('redelivering the same FIRE_RESULT (e.g. a STOMP reconnect) does not double-count hits or sunk ships', () => {
    // Le socle rediffuse à toute la salle, moi compris, et une reconnexion peut livrer le même message deux
    // fois : le réducteur doit rester idempotent, pas seulement correct au premier passage.
    const state = battleState({ turnSeat: 1 })
    const event: RemoteEvent = {
      type: 'FIRE_RESULT',
      payload: { by: 1, targets: [{ row: 0, col: 0 }, { row: 0, col: 1 }], results: ['hit', 'hit'], sunk: [myFleet[0].ship], gameOver: true },
    }
    const once = applyRemoteEvent(state, event).state
    const twice = applyRemoteEvent(once, event).state
    expect(twice.hitsOnOpponent).toBe(once.hitsOnOpponent)
    expect(twice.shipsSunkByMe).toBe(once.shipsSunkByMe)
    expect(twice.shotsOnOpponent.size).toBe(once.shotsOnOpponent.size)
  })

  it('ends the game without queuing a submission for the losing side', () => {
    const state = battleState({ turnSeat: 2 })
    const event: RemoteEvent = {
      type: 'FIRE_RESULT',
      payload: { by: 2, targets: [{ row: 0, col: 1 }], results: ['hit'], sunk: [myFleet[0].ship], gameOver: true },
    }
    const { state: next } = applyRemoteEvent(state, event)
    expect(next.phase).toBe('over')
    expect(next.winnerSeat).toBe(2)
    expect(next.pendingSubmit).toBeNull()
  })
})

describe('FIRE — turn guard', () => {
  it('refuses to fire when it is not my turn', () => {
    const state = battleState({ turnSeat: 2 })
    const { state: next, outbox } = applyLocalIntent(state, { kind: 'FIRE', targets: [{ row: 0, col: 0 }] })
    expect(outbox).toEqual([])
    expect(next).toBe(state)
  })

  it('sends a FIRE with every targeted cell when it is my turn (salvo = several targets at once)', () => {
    const state = battleState({ turnSeat: 1 })
    const targets = [{ row: 1, col: 1 }, { row: 2, col: 2 }, { row: 3, col: 3 }]
    const { outbox } = applyLocalIntent(state, { kind: 'FIRE', targets, bonus: 'salvo' })
    expect(outbox).toEqual([{ type: 'FIRE', data: { by: 1, targets } }])
  })

  it('marks the bonus as used immediately, locally, without waiting for a network round-trip', () => {
    const state = battleState({ turnSeat: 1 })
    const { state: next } = applyLocalIntent(state, { kind: 'FIRE', targets: [{ row: 1, col: 1 }], bonus: 'nuke' })
    expect(next.usedBonuses.has('nuke')).toBe(true)
  })
})

describe('RADAR', () => {
  it('ignores the echo of my own scan', () => {
    const state = battleState()
    const { state: next, outbox } = applyRemoteEvent(state, { type: 'RADAR', payload: { by: 1, zone: [] } })
    expect(outbox).toEqual([])
    expect(next).toBe(state)
  })

  it('as the scanned side, replies with which cells of the zone are occupied, without marking them shot', () => {
    const state = battleState()
    const zone = [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 9, col: 9 }]
    const { outbox } = applyRemoteEvent(state, { type: 'RADAR', payload: { by: 2, zone } })
    expect(outbox).toEqual([
      {
        type: 'RADAR_RESULT',
        data: { by: 2, zone, occupied: [{ row: 0, col: 0 }, { row: 0, col: 1 }] },
      },
    ])
  })

  it('as the scanner, records the revealed cells and the turn passes on', () => {
    const state = battleState({ turnSeat: 1 })
    const occupied = [{ row: 4, col: 4 }]
    const { state: next } = applyRemoteEvent(state, {
      type: 'RADAR_RESULT',
      payload: { by: 1, zone: occupied, occupied },
    })
    expect(next.radarRevealsOnOpponent.has(coordKey({ row: 4, col: 4 }))).toBe(true)
    expect(next.turnSeat).toBe(2)
  })

  it('marks radar as used locally as soon as I send it', () => {
    const state = battleState({ turnSeat: 1 })
    const { state: next } = applyLocalIntent(state, { kind: 'RADAR', zone: [{ row: 0, col: 0 }] })
    expect(next.usedBonuses.has('radar')).toBe(true)
  })
})

describe('availableBonuses', () => {
  it('is empty outside augmented mode, whatever the progress', () => {
    const state = battleState({ augmented: false, shipsSunkByMe: 5, shotsOnOpponent: new Set(Array.from({ length: 20 }, (_, i) => `0,${i}`)) })
    expect(availableBonuses(state)).toEqual([])
  })

  it('unlocks progressively: salvo after a sink, radar then nuke after enough shots', () => {
    const base = battleState({ augmented: true })
    expect(availableBonuses(base)).toEqual([])
    expect(availableBonuses({ ...base, shipsSunkByMe: 1 })).toEqual(['salvo'])

    const fiveShots = new Set(Array.from({ length: 5 }, (_, i) => `0,${i}`))
    expect(availableBonuses({ ...base, shipsSunkByMe: 1, shotsOnOpponent: fiveShots })).toEqual(['salvo', 'radar'])

    const tenShots = new Set(Array.from({ length: 10 }, (_, i) => `0,${i}`))
    expect(availableBonuses({ ...base, shipsSunkByMe: 1, shotsOnOpponent: tenShots })).toEqual(['salvo', 'radar', 'nuke'])
  })

  it('excludes a bonus already used even if still unlocked', () => {
    const state = battleState({ augmented: true, shipsSunkByMe: 1, usedBonuses: new Set(['salvo']) })
    expect(availableBonuses(state)).toEqual([])
  })
})

describe('PLAYER_LEFT', () => {
  it('ends the game with no resume: just flags disconnected', () => {
    const state = battleState()
    const { state: next, outbox } = applyRemoteEvent(state, { type: 'PLAYER_LEFT', payload: {} })
    expect(next.disconnected).toBe(true)
    expect(outbox).toEqual([])
  })
})

describe('READY received after my own battle has already started', () => {
  it('flags the game as unable to continue and tells the other side, instead of hanging forever', () => {
    // Un READY qui arrive alors que je ne suis plus en placement ne peut venir que d'un adversaire dont le
    // client est reparti de zéro (page rechargée) : aucune reprise n'est prise en charge, la partie ne peut
    // plus continuer. Sans ça, l'adversaire resterait bloqué indéfiniment sur son écran d'attente.
    const state = battleState({ turnSeat: 1 })
    const { state: next, outbox } = applyRemoteEvent(state, { type: 'READY', payload: { by: 2 } })
    expect(next.disconnected).toBe(true)
    expect(outbox).toEqual([{ type: 'GAME_ABANDONED', data: null }])
  })

  it('does not end the game while still in placement: a normal READY handshake is unaffected', () => {
    const state = createNetState(1, myFleet, false)
    const { state: next, outbox } = applyRemoteEvent(state, { type: 'READY', payload: { by: 2 } })
    expect(next.disconnected).toBe(false)
    expect(outbox).toEqual([])
  })

  it('ignores the echo of my own READY arriving after I have already reached battle', () => {
    // Sans ce garde-fou : ma propre confirmation (ci-dessous) ou mon propre envoi initial, qui me
    // reviennent forcément après que j'ai déjà basculé en bataille, se feraient passer pour un abandon.
    const state = battleState({ turnSeat: 1 })
    const { state: next, outbox } = applyRemoteEvent(state, { type: 'READY', payload: { by: 1 } })
    expect(next.disconnected).toBe(false)
    expect(outbox).toEqual([])
  })

  it("ignores a confirmation READY from the opponent, part of a normal handshake settling", () => {
    // La confirmation de l'adversaire (déclenchée dès qu'il découvre les deux sièges prêts) arrive elle
    // aussi après que j'ai déjà basculé en bataille : ce n'est pas un rechargement, juste la fin normale
    // du handshake des deux côtés.
    const state = battleState({ turnSeat: 1 })
    const { state: next, outbox } = applyRemoteEvent(state, { type: 'READY', payload: { by: 2, confirm: true } })
    expect(next.disconnected).toBe(false)
    expect(outbox).toEqual([])
  })
})

describe('serializeNetState / deserializeNetState — reprise après rechargement', () => {
  it('round-trips a state with every Set/Map field populated, through JSON (localStorage)', () => {
    const state: NetState = {
      ...battleState({ turnSeat: 2 }),
      readySeats: new Set([1, 2]),
      shotsOnMe: new Set([coordKey({ row: 0, col: 0 })]),
      shotsOnOpponent: new Set([coordKey({ row: 3, col: 3 }), coordKey({ row: 4, col: 4 })]),
      resultsOnOpponent: new Map([
        [coordKey({ row: 3, col: 3 }), 'hit'],
        [coordKey({ row: 4, col: 4 }), 'miss'],
      ]),
      radarRevealsOnOpponent: new Set([coordKey({ row: 5, col: 5 })]),
      hitsOnOpponent: 1,
      shipsSunkByMe: 1,
      sunkOpponentShips: new Set(['Torpilleur']),
      usedBonuses: new Set(['radar']),
      augmented: true,
      pendingSubmit: { shots: 3, hits: 1 },
      lastEvent: { kind: 'fire', by: 1, targets: [{ row: 3, col: 3 }], results: ['hit'], sunk: [] },
    }

    // Comme pour `localStorage`, qui ne sait écrire que des chaînes.
    const roundTripped = deserializeNetState(JSON.parse(JSON.stringify(serializeNetState(state))))

    expect(roundTripped).toEqual(state)
  })
})

describe('GAME_ABANDONED', () => {
  it('ends the game on the receiving side too (the reloading player, catching up)', () => {
    const state = createNetState(2, myFleet, false) // toujours en placement : c'est le joueur qui a rechargé
    const { state: next, outbox } = applyRemoteEvent(state, { type: 'GAME_ABANDONED', payload: null })
    expect(next.disconnected).toBe(true)
    expect(outbox).toEqual([])
  })
})
