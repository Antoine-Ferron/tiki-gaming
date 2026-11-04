import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

vi.mock('sockjs-client', () => ({ default: vi.fn() }))

type StompConfig = { onConnect?: () => void; onWebSocketClose?: () => void; onStompError?: () => void }

/**
 * Double en mémoire du client `@stomp/stompjs` : aucun réseau, les réponses sont livrées à la main par le test.
 * `activate()` appelé une seconde fois simule une reconnexion : comme le vrai client, les abonnements précédents
 * ne survivent pas (il faut se réabonner dans `onConnect`).
 */
class FakeStompClient {
  static instances: FakeStompClient[] = []
  readonly published: { destination: string; body: string }[] = []
  private subscribers = new Map<string, (message: { body: string }) => void>()
  private connectedOnce = false
  private readonly onConnect?: () => void
  readonly onWebSocketClose?: () => void
  readonly onStompError?: () => void

  constructor(config: StompConfig) {
    this.onConnect = config.onConnect
    this.onWebSocketClose = config.onWebSocketClose
    this.onStompError = config.onStompError
    FakeStompClient.instances.push(this)
  }

  activate() {
    if (this.connectedOnce) this.subscribers = new Map()
    this.connectedOnce = true
    this.onConnect?.()
  }

  subscribe(destination: string, callback: (message: { body: string }) => void) {
    this.subscribers.set(destination, callback)
    return { unsubscribe: () => this.subscribers.delete(destination) }
  }

  publish({ destination, body }: { destination: string; body: string }) {
    this.published.push({ destination, body })
  }

  isSubscribedTo(destination: string) {
    return this.subscribers.has(destination)
  }

  /** Test uniquement : simule un message reçu du serveur sur une destination abonnée. */
  deliver(destination: string, payload: unknown) {
    this.subscribers.get(destination)?.({ body: JSON.stringify(payload) })
  }
}

vi.mock('@stomp/stompjs', () => ({ Client: FakeStompClient }))

const { createRealtime } = await import('./realtime')

const roomView = (overrides: Partial<Record<string, unknown>> = {}) => ({
  gameSlug: 'bataille-navale',
  code: 'ABC123',
  seat: 1,
  playerCount: 1,
  maxPlayers: 2,
  ...overrides,
})

const tick = () => Promise.resolve().then(() => Promise.resolve())

function lastClient() {
  const client = FakeStompClient.instances.at(-1)
  if (!client) throw new Error('Aucun client STOMP créé')
  return client
}

beforeEach(() => {
  FakeStompClient.instances.length = 0
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('createRealtime', () => {
  test('createRoom publie sur /app/rooms/{slug}/create et résout avec la vue reçue', async () => {
    const realtime = createRealtime('bataille-navale')

    const pending = realtime.createRoom(2)
    await tick()
    const stomp = lastClient()
    expect(stomp.published).toEqual([
      { destination: '/app/rooms/bataille-navale/create', body: JSON.stringify({ maxPlayers: 2 }) },
    ])
    stomp.deliver('/user/queue/rooms/bataille-navale/response', roomView())

    const connection = await pending
    expect(connection.code).toBe('ABC123')
    expect(connection.seat).toBe(1)
    expect(connection.playerCount).toBe(1)
  })

  test('joinRoom rejette avec une GameError quand le serveur répond par une erreur', async () => {
    const realtime = createRealtime('bataille-navale')

    const pending = realtime.joinRoom('UNKNOWN')
    await tick()
    lastClient().deliver('/user/queue/rooms/bataille-navale/errors', { status: 404, error: 'Code de salle inconnu.' })

    await expect(pending).rejects.toMatchObject({ code: 'not_found', message: 'Code de salle inconnu.' })
  })

  test('deux appels concurrents ne se répondent pas l’un à l’autre', async () => {
    const realtime = createRealtime('bataille-navale')

    const createPending = realtime.createRoom(2)
    const joinPending = realtime.joinRoom('DEF456')
    await tick()
    const stomp = lastClient()
    // Une seule requête part à la fois : la seconde n'est publiée qu'une fois la première résolue.
    expect(stomp.published).toEqual([
      { destination: '/app/rooms/bataille-navale/create', body: JSON.stringify({ maxPlayers: 2 }) },
    ])

    stomp.deliver('/user/queue/rooms/bataille-navale/response', roomView({ code: 'ABC123' }))
    const created = await createPending
    expect(created.code).toBe('ABC123')

    await tick()
    expect(stomp.published).toContainEqual({
      destination: '/app/rooms/bataille-navale/join',
      body: JSON.stringify({ code: 'DEF456' }),
    })
    stomp.deliver('/user/queue/rooms/bataille-navale/response', roomView({ code: 'DEF456', seat: 2, playerCount: 2 }))
    const joined = await joinPending
    expect(joined.code).toBe('DEF456')
  })

  test('diffuse les évènements du topic de la salle et met à jour le siège sur ROOM_UPDATED', async () => {
    const realtime = createRealtime('bataille-navale')
    const pending = realtime.createRoom(2)
    await tick()
    const stomp = lastClient()
    stomp.deliver('/user/queue/rooms/bataille-navale/response', roomView())
    const connection = await pending

    const received = vi.fn()
    connection.on('COUP_JOUE', received)
    stomp.deliver('/topic/rooms/bataille-navale/ABC123', {
      type: 'COUP_JOUE',
      payload: { case: 'A1' },
      code: 'ABC123',
      serverTime: '2026-11-03T12:00:00Z',
    })
    expect(received).toHaveBeenCalledWith(expect.objectContaining({ type: 'COUP_JOUE', payload: { case: 'A1' } }))

    stomp.deliver('/topic/rooms/bataille-navale/ABC123', {
      type: 'ROOM_UPDATED',
      payload: roomView({ seat: 2, playerCount: 2 }),
      code: 'ABC123',
      serverTime: '2026-11-03T12:00:01Z',
    })
    expect(connection.seat).toBe(2)
    expect(connection.playerCount).toBe(2)
  })

  test('un évènement ROOM_UPDATED malformé ne corrompt pas le siège', async () => {
    const realtime = createRealtime('bataille-navale')
    const pending = realtime.createRoom(2)
    await tick()
    const stomp = lastClient()
    stomp.deliver('/user/queue/rooms/bataille-navale/response', roomView())
    const connection = await pending

    // Un jeu qui nommerait par erreur une de ses actions "ROOM_UPDATED" ne doit pas corrompre seat/playerCount.
    stomp.deliver('/topic/rooms/bataille-navale/ABC123', {
      type: 'ROOM_UPDATED',
      payload: { aCeciNEstPasUneRoomView: true },
      code: 'ABC123',
      serverTime: '2026-11-03T12:00:01Z',
    })

    expect(connection.seat).toBe(1)
    expect(connection.playerCount).toBe(1)
  })

  test('send publie une action avec un actionId généré par défaut', async () => {
    const realtime = createRealtime('bataille-navale')
    const pending = realtime.createRoom(2)
    await tick()
    const stomp = lastClient()
    stomp.deliver('/user/queue/rooms/bataille-navale/response', roomView())
    const connection = await pending

    connection.send('TIR', { case: 'B2' })

    const action = stomp.published.find((m) => m.destination === '/app/rooms/bataille-navale/ABC123/actions')
    expect(action).toBeDefined()
    const body = JSON.parse(action!.body)
    expect(body).toMatchObject({ type: 'TIR', data: { case: 'B2' } })
    expect(body.actionId).toEqual(expect.any(String))
  })

  test('onStatusChange est notifié des coupures, et close quitte la salle et désabonne le topic', async () => {
    const realtime = createRealtime('bataille-navale')
    const pending = realtime.createRoom(2)
    await tick()
    const stomp = lastClient()
    stomp.deliver('/user/queue/rooms/bataille-navale/response', roomView())
    const connection = await pending

    const statuses: string[] = []
    connection.onStatusChange((status) => statuses.push(status))
    stomp.onWebSocketClose?.()
    expect(statuses).toEqual(['reconnecting'])

    connection.close()
    expect(stomp.published).toContainEqual({
      destination: '/app/rooms/bataille-navale/leave',
      body: JSON.stringify({ code: 'ABC123' }),
    })
    const received = vi.fn()
    connection.on('COUP_JOUE', received)
    stomp.deliver('/topic/rooms/bataille-navale/ABC123', {
      type: 'COUP_JOUE',
      payload: {},
      code: 'ABC123',
      serverTime: '2026-11-03T12:00:00Z',
    })
    expect(received).not.toHaveBeenCalled()
  })

  test('une reconnexion renvoie automatiquement join et rétablit l’abonnement au canal', async () => {
    const realtime = createRealtime('bataille-navale')
    const pending = realtime.createRoom(2)
    await tick()
    const stomp = lastClient()
    stomp.deliver('/user/queue/rooms/bataille-navale/response', roomView())
    const connection = await pending

    stomp.activate() // simule le onConnect d'une reconnexion automatique du client STOMP (le fake vide ses abonnements)
    expect(stomp.published).toContainEqual({
      destination: '/app/rooms/bataille-navale/join',
      body: JSON.stringify({ code: 'ABC123' }),
    })
    expect(stomp.isSubscribedTo('/topic/rooms/bataille-navale/ABC123')).toBe(true)

    const received = vi.fn()
    connection.on('COUP_JOUE', received)
    stomp.deliver('/topic/rooms/bataille-navale/ABC123', {
      type: 'COUP_JOUE',
      payload: { case: 'A1' },
      code: 'ABC123',
      serverTime: '2026-11-03T12:00:00Z',
    })
    expect(received).toHaveBeenCalled()
  })

  test('une reconnexion après un close ne rejoint pas la salle quittée', async () => {
    const realtime = createRealtime('bataille-navale')
    const pending = realtime.createRoom(2)
    await tick()
    const stomp = lastClient()
    stomp.deliver('/user/queue/rooms/bataille-navale/response', roomView())
    const connection = await pending
    connection.close()
    stomp.published.length = 0

    stomp.activate() // reconnexion après avoir explicitement quitté la salle

    expect(stomp.published).not.toContainEqual({
      destination: '/app/rooms/bataille-navale/join',
      body: JSON.stringify({ code: 'ABC123' }),
    })
  })
})
