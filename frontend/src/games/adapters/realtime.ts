import { Client, type IMessage, type StompSubscription } from '@stomp/stompjs'
import SockJS from 'sockjs-client'
import { GameError, type GameErrorCode } from '../errors'
import type { Realtime, RealtimeConnection, RealtimeStatus, RoomEvent } from '../ports'

/** Vue d'une salle telle qu'envoyée par le serveur (fr.tikigaming.realtime.RoomView). */
type RoomView = { gameSlug: string; code: string; seat: number; playerCount: number; maxPlayers: number }
type RoomErrorMessage = { status: number; error: string }

// Le message est toujours écrit pour le joueur (même contrat que ApiError côté REST) : on le garde tel quel.
const STATUS_CODE: Record<number, GameErrorCode> = { 401: 'session', 403: 'forbidden', 404: 'not_found' }

function errorFor(message: RoomErrorMessage): GameError {
  const code = message.status >= 500 ? 'network' : (STATUS_CODE[message.status] ?? 'unknown')
  return new GameError(code, message.error)
}

/** Une connexion par salle : un client STOMP partagé par jeu, fermé quand la salle n'est plus utile. */
class StompRoomConnection implements RealtimeConnection {
  seat: number
  playerCount: number
  private readonly subscriptions: StompSubscription[] = []
  private readonly handlers = new Map<string, Set<(event: RoomEvent) => void>>()
  private readonly statusHandlers = new Set<(status: RealtimeStatus) => void>()

  constructor(
    readonly code: string,
    private readonly gameSlug: string,
    view: RoomView,
    private readonly client: Client,
  ) {
    this.seat = view.seat
    this.playerCount = view.playerCount
    this.subscriptions.push(client.subscribe(`/topic/rooms/${gameSlug}/${code}`, (message) => this.dispatch(message)))
  }

  private dispatch(message: IMessage) {
    const event = JSON.parse(message.body) as RoomEvent
    if (event.type === 'ROOM_UPDATED') {
      const view = event.payload as RoomView
      this.seat = view.seat
      this.playerCount = view.playerCount
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
    for (const subscription of this.subscriptions) subscription.unsubscribe()
  }
}

/** Envoie une requête sur `/app/...` et attend la réponse (ou l'erreur) dédiée à ce compte. */
function requestRoom(client: Client, gameSlug: string, action: string, body: unknown): Promise<RoomView> {
  return new Promise((resolve, reject) => {
    const responseSub = client.subscribe(`/user/queue/rooms/${gameSlug}/response`, (message) => {
      responseSub.unsubscribe()
      errorSub.unsubscribe()
      resolve(JSON.parse(message.body) as RoomView)
    })
    const errorSub = client.subscribe(`/user/queue/rooms/${gameSlug}/errors`, (message) => {
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
 * (`reconnectDelay`) ; `onReconnect` renvoie `join` avec le dernier code connu pour retrouver le siège.
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

  const ensureClient = () => {
    clientPromise ??= connectedClient(
      (status) => lastConnection?.notifyStatus(status),
      (client) => {
        if (!lastConnection) return
        client.publish({
          destination: `/app/rooms/${gameSlug}/join`,
          body: JSON.stringify({ code: lastConnection.code }),
        })
      },
    )
    return clientPromise
  }

  const open = async (action: string, body: unknown) => {
    const client = await ensureClient()
    const view = await requestRoom(client, gameSlug, action, body)
    lastConnection = new StompRoomConnection(view.code, gameSlug, view, client)
    return lastConnection
  }

  return {
    createRoom: (maxPlayers = 8) => open('create', { maxPlayers }),
    joinRoom: (code) => open('join', { code }),
  }
}
