import { Client, type IMessage, type StompSubscription } from '@stomp/stompjs'
import SockJS from 'sockjs-client'
import { codeForStatus, GameError } from '../errors'
import { ROOM_EVENT_TYPES, type Realtime, type RealtimeConnection, type RealtimeStatus, type RoomEvent } from '../ports'

/** Vue d'une salle telle qu'envoyée au compte qui vient de créer/rejoindre (fr.tikigaming.realtime.RoomView). */
type RoomView = { gameSlug: string; code: string; seat: number; playerCount: number; maxPlayers: number }
/** Vue diffusée à toute la salle (fr.tikigaming.realtime.RoomSummary) : jamais de `seat`, qui n'a de sens que pour
 * le compte à qui il appartient — les autres joueurs assis ne doivent jamais se le voir appliquer. */
type RoomSummary = { gameSlug: string; code: string; playerCount: number; maxPlayers: number }
type RoomErrorMessage = { status: number; error: string }

/** Délai au-delà duquel une création/jonction sans réponse du serveur est abandonnée (connexion coupée entre-temps). */
const REQUEST_TIMEOUT_MS = 10_000

function errorFor(message: RoomErrorMessage): GameError {
  // Le message est toujours écrit pour le joueur (même contrat que ApiError côté REST) : on le garde tel quel.
  return new GameError(codeForStatus(message.status) ?? 'unknown', message.error)
}

/** Une connexion par salle : un client STOMP partagé par jeu, fermé quand la salle n'est plus utile. */
class StompRoomConnection implements RealtimeConnection {
  seat: number
  playerCount: number
  private readonly subscriptions: StompSubscription[] = []
  private readonly handlers = new Map<string, Set<(event: RoomEvent) => void>>()
  private readonly statusHandlers = new Set<(status: RealtimeStatus) => void>()
  private closed = false

  constructor(
    readonly code: string,
    private readonly gameSlug: string,
    view: RoomView,
    private readonly client: Client,
    private readonly onClose: () => void,
  ) {
    this.seat = view.seat
    this.playerCount = view.playerCount
    this.subscribeToTopic()
  }

  /** (Ré)établit l'abonnement au canal de la salle : appelé à la création et après chaque reconnexion. */
  subscribeToTopic() {
    for (const subscription of this.subscriptions.splice(0)) subscription.unsubscribe()
    this.subscriptions.push(
      this.client.subscribe(`/topic/rooms/${this.gameSlug}/${this.code}`, (message) => this.dispatch(message)),
    )
  }

  private dispatch(message: IMessage) {
    const event = JSON.parse(message.body) as RoomEvent
    // Diffusé à toute la salle : seul playerCount s'applique ici. Le siège est propre à chaque compte (il décale à
    // chaque départ) et n'arrive jamais que par une réponse directe (voir le constructeur et `requestRoom`).
    const isRoomUpdate = event.type === ROOM_EVENT_TYPES.ROOM_UPDATED || event.type === ROOM_EVENT_TYPES.PLAYER_LEFT
    if (isRoomUpdate && isRoomSummary(event.payload)) {
      this.playerCount = event.payload.playerCount
    }
    for (const handler of this.handlers.get(event.type) ?? []) handler(event)
  }

  send(type: string, data: unknown = null, actionId: string = crypto.randomUUID()) {
    this.client.publish({
      destination: `/app/rooms/${this.gameSlug}/${this.code}/actions`,
      body: JSON.stringify({ type, actionId, data }),
    })
  }

  on<T = unknown>(type: string, handler: (event: RoomEvent<T>) => void) {
    const forType = this.handlers.get(type) ?? new Set()
    forType.add(handler as (event: RoomEvent) => void)
    this.handlers.set(type, forType)
    return () => forType.delete(handler as (event: RoomEvent) => void)
  }

  onStatusChange(handler: (status: RealtimeStatus) => void) {
    this.statusHandlers.add(handler)
    return () => this.statusHandlers.delete(handler)
  }

  /** Appelé par createRealtime au fil des évènements de connexion du client STOMP partagé. */
  notifyStatus(status: RealtimeStatus) {
    for (const handler of this.statusHandlers) handler(status)
  }

  close() {
    if (this.closed) return
    this.closed = true
    this.client.publish({
      destination: `/app/rooms/${this.gameSlug}/leave`,
      body: JSON.stringify({ code: this.code }),
    })
    for (const subscription of this.subscriptions.splice(0)) subscription.unsubscribe()
    this.onClose()
  }
}

/** Vrai si `payload` a la forme d'une `RoomSummary` (garde avant de lire `playerCount`). */
function isRoomSummary(payload: unknown): payload is RoomSummary {
  return typeof payload === 'object' && payload !== null && typeof (payload as RoomSummary).playerCount === 'number'
}

/**
 * Envoie une requête sur `/app/...` et attend la réponse (ou l'erreur) dédiée à ce compte. Abandonnée après
 * `REQUEST_TIMEOUT_MS` sans réponse (connexion coupée entre l'abonnement et la publication, ou après) : sans ce
 * filet, la promesse ne se résoudrait jamais et, les appels étant sérialisés, gèlerait aussi tous les suivants.
 */
function requestRoom(client: Client, gameSlug: string, action: string, body: unknown): Promise<RoomView> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      responseSub.unsubscribe()
      errorSub.unsubscribe()
      reject(new GameError('network', 'Le serveur ne répond pas. Vérifie ta connexion et réessaie.'))
    }, REQUEST_TIMEOUT_MS)
    const responseSub = client.subscribe(`/user/queue/rooms/${gameSlug}/response`, (message) => {
      clearTimeout(timeout)
      responseSub.unsubscribe()
      errorSub.unsubscribe()
      resolve(JSON.parse(message.body) as RoomView)
    })
    const errorSub = client.subscribe(`/user/queue/rooms/${gameSlug}/errors`, (message) => {
      clearTimeout(timeout)
      responseSub.unsubscribe()
      errorSub.unsubscribe()
      reject(errorFor(JSON.parse(message.body) as RoomErrorMessage))
    })
    client.publish({ destination: `/app/rooms/${gameSlug}/${action}`, body: JSON.stringify(body) })
  })
}

/**
 * Un seul client STOMP par jeu, connecté à la demande (premier `createRoom`/`joinRoom`) : un jeu solo qui
 * n'utilise jamais `ctx.realtime` n'ouvre donc aucune connexion. La reconnexion est automatique
 * (`reconnectDelay`) ; `onReconnect` renvoie `join` avec le dernier code connu pour retrouver le siège et
 * rétablit l'abonnement au canal (une reconnexion STOMP ne restaure pas les abonnements toute seule).
 */
function connectedClient(onStatus: (status: RealtimeStatus) => void, onReconnect: (client: Client) => void) {
  return new Promise<Client>((resolve) => {
    let firstConnect = true
    const client = new Client({
      webSocketFactory: () => new SockJS('/ws'),
      reconnectDelay: 2000,
      onConnect: () => {
        onStatus('open')
        if (firstConnect) {
          firstConnect = false
          resolve(client)
        } else {
          onReconnect(client)
        }
      },
      onWebSocketClose: () => onStatus('reconnecting'),
      onStompError: () => onStatus('reconnecting'),
    })
    onStatus('connecting')
    client.activate()
  })
}

/** Fabrique le port `Realtime` d'un jeu (voir ./index.ts, platformDeps). */
export function createRealtime(gameSlug: string): Realtime {
  let lastConnection: StompRoomConnection | null = null
  let clientPromise: Promise<Client> | null = null
  // Sérialise les appels createRoom/joinRoom : deux requêtes concurrentes sur le même compte partageraient sinon
  // les mêmes destinations /user/queue/rooms/{slug}/response|errors et pourraient résoudre l'une avec la réponse
  // de l'autre.
  let queue: Promise<unknown> = Promise.resolve()

  const ensureClient = () => {
    clientPromise ??= connectedClient(
      (status) => lastConnection?.notifyStatus(status),
      (client) => {
        if (!lastConnection) return
        lastConnection.subscribeToTopic()
        client.publish({
          destination: `/app/rooms/${gameSlug}/join`,
          body: JSON.stringify({ code: lastConnection.code }),
        })
      },
    )
    return clientPromise
  }

  const open = (action: string, body: unknown): Promise<RealtimeConnection> => {
    const result = queue.then(async () => {
      const client = await ensureClient()
      const view = await requestRoom(client, gameSlug, action, body)
      const connection = new StompRoomConnection(view.code, gameSlug, view, client, () => {
        if (lastConnection === connection) lastConnection = null
      })
      lastConnection = connection
      return connection
    })
    // Une requête refusée ne doit pas bloquer les suivantes dans la file.
    queue = result.catch(() => undefined)
    return result
  }

  return {
    createRoom: (maxPlayers = 8) => open('create', { maxPlayers }),
    joinRoom: (code) => open('join', { code }),
  }
}
