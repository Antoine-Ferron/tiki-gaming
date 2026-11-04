// @vitest-environment jsdom
import { StrictMode } from 'react'
import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { FakeRealtimeConnection } from '../testing/fakes'
import type { GameContext } from '../types'
import { FLEET, shipCoords, type PlacedShip } from './logic'
import { createNetState } from './network'
import { useNetGame } from './useNetGame'

afterEach(() => {
  vi.useRealTimers()
})

const fleet: PlacedShip[] = [{ ship: FLEET[0], coords: shipCoords({ row: 0, col: 0 }, FLEET[0].size, 'horizontal') }]

function buildCtx(): GameContext {
  return {
    gameSlug: 'bataille-navale',
    player: { id: 'u1', username: 'alice' },
    isGuest: false,
    submitScore: vi.fn().mockResolvedValue(true),
    getLeaderboard: vi.fn().mockResolvedValue([]),
    getMyBest: vi.fn().mockResolvedValue(null),
    loadSave: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockResolvedValue(undefined),
    clearSave: vi.fn().mockResolvedValue(undefined),
    realtime: { createRoom: vi.fn(), joinRoom: vi.fn() },
  }
}

describe('useNetGame — READY handshake', () => {
  test('sends READY as soon as it mounts, without waiting for an explicit call', () => {
    const connection = new FakeRealtimeConnection('ROOM-1', 1, 2)
    renderHook(() => useNetGame(connection, fleet, false, buildCtx()))

    expect(connection.sent).toContainEqual({ type: 'READY', data: { by: 1 }, actionId: undefined })
  })

  /**
   * Bug réel observé en développement : l'app est montée sous <StrictMode>, qui rejoue exprès chaque effet
   * (montage → nettoyage → montage) pour détecter les effets non idempotents. Sans garde, l'effet qui envoie
   * le premier READY — sans aucun nettoyage — partait donc deux fois.
   */
  test('sends the initial READY only once under <StrictMode>, which replays mount effects', () => {
    const connection = new FakeRealtimeConnection('ROOM-1', 1, 2)
    renderHook(() => useNetGame(connection, fleet, false, buildCtx()), { wrapper: StrictMode })

    expect(connection.sent.filter((a) => a.type === 'READY' && !(a.data as { confirm?: boolean }).confirm)).toHaveLength(1)
  })

  test('does not flag the game as abandoned by its own StrictMode-replayed initial READY, after both are ready', () => {
    const connection = new FakeRealtimeConnection('ROOM-1', 1, 2)
    const { result } = renderHook(() => useNetGame(connection, fleet, false, buildCtx()), { wrapper: StrictMode })

    act(() => {
      connection.emit('READY', { by: 1 })
      connection.emit('READY', { by: 2 })
    })
    expect(result.current.state.phase).toBe('battle')
    expect(result.current.state.disconnected).toBe(false)
  })

  test('sends one extra confirmation the instant both seats are first confirmed, then never again', () => {
    const connection = new FakeRealtimeConnection('ROOM-1', 1, 2)
    renderHook(() => useNetGame(connection, fleet, false, buildCtx()))

    act(() => {
      connection.emit('READY', { by: 1 }) // mon propre écho : je ne sais toujours pas si l'adversaire est là
    })
    expect(connection.sent.filter((a) => a.type === 'READY')).toHaveLength(1) // juste mon envoi initial

    act(() => {
      connection.emit('READY', { by: 2 }) // l'adversaire vient d'arriver : je lui renvoie le mien une dernière fois
    })
    expect(connection.sent.filter((a) => a.type === 'READY')).toHaveLength(2)

    act(() => {
      connection.emit('READY', { by: 2 }) // un doublon (retentative réseau) ne déclenche pas une nouvelle confirmation
    })
    expect(connection.sent.filter((a) => a.type === 'READY')).toHaveLength(2)
  })

  /**
   * Bug réel observé : les deux côtés affichaient « la partie ne peut plus continuer » juste après que les
   * deux joueurs se soient dits prêts. Cause : le socle renvoie à l'expéditeur son propre message (écho) — la
   * confirmation que j'envoie à l'instant où je bascule en bataille me revient donc forcément, alors que je
   * ne suis déjà plus en placement.
   */
  test("does not flag the game as abandoned when my own confirmation echoes back to me", () => {
    const connection = new FakeRealtimeConnection('ROOM-1', 1, 2)
    const { result } = renderHook(() => useNetGame(connection, fleet, false, buildCtx()))

    act(() => {
      connection.emit('READY', { by: 1 })
      connection.emit('READY', { by: 2 }) // déclenche ma confirmation, envoyée par le hook
    })
    expect(result.current.state.phase).toBe('battle')

    const confirmation = connection.sent.find((a) => a.type === 'READY' && (a.data as { confirm?: boolean }).confirm)
    expect(confirmation).toBeDefined()
    act(() => {
      connection.emit('READY', confirmation!.data) // le socle me renvoie ma propre confirmation (écho)
    })

    expect(result.current.state.disconnected).toBe(false)
  })

  test("does not flag the game as abandoned when the opponent's own confirmation arrives after mine", () => {
    const connection = new FakeRealtimeConnection('ROOM-1', 1, 2)
    const { result } = renderHook(() => useNetGame(connection, fleet, false, buildCtx()))

    act(() => {
      connection.emit('READY', { by: 1 })
      connection.emit('READY', { by: 2 }) // je bascule déjà en bataille ici
    })
    expect(result.current.state.phase).toBe('battle')

    act(() => {
      connection.emit('READY', { by: 2, confirm: true }) // la confirmation symétrique de l'adversaire
    })

    expect(result.current.state.disconnected).toBe(false)
  })

  /**
   * Reproduit le bug réel : le socle ne rediffuse un message qu'aux comptes déjà abonnés, sans historique.
   * Si le joueur 1 envoie son READY avant que le joueur 2 n'ait rejoint la salle, ce premier message est
   * perdu pour le joueur 2, qui resterait bloqué sur l'écran d'attente sans la confirmation renvoyée par
   * `network.ts` dès que le joueur 1 reçoit le sien (voir son commentaire pour le cas 'READY').
   */
  test('a second player who joins late still reaches the battle, thanks to the one-shot confirmation', () => {
    vi.useFakeTimers()
    const subscribers: FakeRealtimeConnection[] = []
    function joinBridgedRoom(seat: number) {
      const connection = new FakeRealtimeConnection('ROOM-1', seat, 2)
      const realSend = connection.send.bind(connection)
      // Livraison asynchrone, comme un vrai aller-retour réseau : un `send` ne doit jamais déclencher de
      // mise à jour d'état de façon synchrone et ré-entrante pendant le rendu d'un autre hook.
      connection.send = (type, data, actionId) => {
        realSend(type, data, actionId)
        setTimeout(() => {
          for (const subscriber of subscribers) subscriber.emit(type, data)
        }, 0)
      }
      subscribers.push(connection) // s'abonne au canal au moment où il rejoint, comme en vrai
      return connection
    }

    const conn1 = joinBridgedRoom(1)
    const player1 = renderHook(() => useNetGame(conn1, fleet, false, buildCtx()))
    act(() => {
      vi.advanceTimersByTime(0) // livre le premier READY du joueur 1 (à lui-même seul : le joueur 2 n'existe pas encore)
    })
    // Le joueur 1 a déjà envoyé (et perdu) son premier READY : le joueur 2 n'a pas encore rejoint la salle.
    expect(player1.result.current.state.phase).toBe('placement')

    const conn2 = joinBridgedRoom(2) // rejoint tardivement
    const player2 = renderHook(() => useNetGame(conn2, fleet, false, buildCtx()))
    act(() => {
      vi.advanceTimersByTime(10) // livre le READY du joueur 2 à tout le monde
    })
    act(() => {
      vi.advanceTimersByTime(10) // livre la confirmation que ce READY vient de déclencher chez le joueur 1
    })

    expect(player1.result.current.state.phase).toBe('battle')
    expect(player2.result.current.state.phase).toBe('battle')
  })
})

describe('useNetGame — un FIRE redélivré après coup ne vole pas la main gagnée par le tir qui a touché', () => {
  /**
   * Bug réel : <StrictMode> rejoue la fonction de mise à jour passée à `setState`, aussi bien dans
   * `dispatchLocal` que dans le gestionnaire d'évènements distants de ce hook — tous deux envoient sur le
   * réseau (`connection.send`) depuis l'intérieur de cette fonction, un effet de bord qu'une redélivrance
   * (volontaire ou non) exécute une seconde fois. Scénario reproduit ici : le même FIRE arrive au défenseur
   * une seconde fois une fois le premier aller-retour déjà réglé (la case est donc déjà marquée tirée) ; le
   * défenseur répond alors « repeat » au lieu de « hit ». Sans le garde-fou de `network.ts`, ce second
   * message faisait à tort passer la main, juste après un tir qui aurait dû faire rejouer le même joueur.
   */
  test('la main reste au tireur sur les deux clients, même après la redélivrance', () => {
    const conn1 = new FakeRealtimeConnection('ROOM-1', 1, 2)
    const conn2 = new FakeRealtimeConnection('ROOM-1', 2, 2)
    // `resume` saute la poignée de main READY (déjà testée ailleurs) pour isoler le seul mécanisme en jeu ici.
    const battleFor = (seat: number) => ({ ...createNetState(seat, fleet, false), phase: 'battle' as const, turnSeat: 1 })
    const player1 = renderHook(() => useNetGame(conn1, fleet, false, buildCtx(), battleFor(1)))
    const player2 = renderHook(() => useNetGame(conn2, fleet, false, buildCtx(), battleFor(2)))

    act(() => {
      player1.result.current.fire([{ row: 0, col: 0 }]) // touche le Porte-avions de player2 (fleet fixe)
    })
    const fireSent = conn1.sent.find((a) => a.type === 'FIRE')!.data

    act(() => {
      conn2.emit('FIRE', fireSent) // le défenseur reçoit le tir, calcule « hit » et répond
    })
    const firstResult = conn2.sent.find((a) => a.type === 'FIRE_RESULT')!.data
    act(() => {
      conn1.emit('FIRE_RESULT', firstResult)
      conn2.emit('FIRE_RESULT', firstResult) // écho symétrique, comme le ferait le socle
    })
    expect(player1.result.current.state.turnSeat).toBe(1) // touché : le joueur 1 garde la main
    expect(player2.result.current.state.turnSeat).toBe(1)

    // Le même FIRE est redélivré après coup (doublon réseau, ou double-envoi de <StrictMode>) : la case est
    // maintenant déjà marquée tirée côté défenseur, qui répond donc « repeat » cette fois.
    act(() => {
      conn2.emit('FIRE', fireSent)
    })
    const redeliveredResult = conn2.sent.filter((a) => a.type === 'FIRE_RESULT').at(-1)!.data
    expect((redeliveredResult as { results: string[] }).results).toEqual(['repeat'])

    act(() => {
      conn1.emit('FIRE_RESULT', redeliveredResult)
      conn2.emit('FIRE_RESULT', redeliveredResult)
    })

    expect(player1.result.current.state.turnSeat).toBe(1) // toujours à lui : la redélivrance n'a rien dû changer
    expect(player2.result.current.state.turnSeat).toBe(1)
  })
})

describe('useNetGame — reprise après rechargement (resume)', () => {
  test('ne renvoie pas de READY au montage quand on reprend une bataille déjà engagée', () => {
    const connection = new FakeRealtimeConnection('ROOM-1', 1, 2)
    const resume = { ...createNetState(1, fleet, false), phase: 'battle' as const, turnSeat: 2 }
    renderHook(() => useNetGame(connection, fleet, false, buildCtx(), resume))

    // Un READY ici se ferait passer pour un rechargement chez l'adversaire (voir le test du décrochage
    // partagé plus bas) : il ne doit tout simplement jamais partir quand on reprend une bataille en cours.
    expect(connection.sent.filter((a) => a.type === 'READY')).toHaveLength(0)
  })

  test('part bien de l’état fourni (pas d’un nouvel état vierge)', () => {
    const connection = new FakeRealtimeConnection('ROOM-1', 1, 2)
    const resume = { ...createNetState(1, fleet, false), phase: 'battle' as const, turnSeat: 2, hitsOnOpponent: 3 }
    const { result } = renderHook(() => useNetGame(connection, fleet, false, buildCtx(), resume))

    expect(result.current.state.phase).toBe('battle')
    expect(result.current.state.hitsOnOpponent).toBe(3)
  })

  test('renvoie quand même READY si la reprise se fait en plein placement (toujours en attente)', () => {
    const connection = new FakeRealtimeConnection('ROOM-1', 1, 2)
    const resume = createNetState(1, fleet, false) // phase 'placement' : ma flotte était déjà posée, READY déjà envoyé avant
    renderHook(() => useNetGame(connection, fleet, false, buildCtx(), resume))

    expect(connection.sent).toContainEqual({ type: 'READY', data: { by: 1 }, actionId: undefined })
  })
})

describe('useNetGame — fin de partie partagée après un rechargement', () => {
  test("un READY reçu alors que je suis déjà en bataille signale que l'adversaire a rechargé sa page", () => {
    const connection = new FakeRealtimeConnection('ROOM-1', 1, 2)
    const { result } = renderHook(() => useNetGame(connection, fleet, false, buildCtx()))

    act(() => {
      connection.emit('READY', { by: 1 })
      connection.emit('READY', { by: 2 })
    })
    expect(result.current.state.phase).toBe('battle')

    act(() => {
      connection.emit('READY', { by: 2 }) // l'adversaire a rechargé : son client reparti de zéro renvoie READY
    })

    expect(result.current.state.disconnected).toBe(true)
    expect(connection.sent).toContainEqual({ type: 'GAME_ABANDONED', data: null, actionId: undefined })
  })
})
