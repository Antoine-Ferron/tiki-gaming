import { useCallback, useEffect, useRef, useState } from 'react'
import { ROOM_EVENT_TYPES, type RealtimeConnection } from '../ports'
import type { GameContext } from '../types'
import { computeScore, type Coord, type PlacedShip } from './logic'
import {
  applyLocalIntent,
  applyRemoteEvent,
  createNetState,
  type LocalIntent,
  type NetState,
  type RemoteEvent,
} from './network'

const REMOTE_TYPES = ['READY', 'FIRE', 'FIRE_RESULT', 'RADAR', 'RADAR_RESULT'] as const

/**
 * Câble le réducteur pur de `network.ts` sur une `RealtimeConnection` : vide son `outbox` vers `connection.send`,
 * convertit les évènements reçus en `RemoteEvent`, et soumet le score une seule fois à la victoire. Ne prend
 * aucune décision de protocole elle-même — tout est dans `network.ts`.
 */
export function useNetGame(connection: RealtimeConnection, myFleet: PlacedShip[], augmented: boolean, ctx: GameContext) {
  const [state, setState] = useState<NetState>(() => createNetState(connection.seat, myFleet, augmented))
  const submittedRef = useRef(false)

  const dispatchLocal = useCallback(
    (intent: LocalIntent) => {
      setState((prev) => {
        const { state: next, outbox } = applyLocalIntent(prev, intent)
        for (const event of outbox) connection.send(event.type, event.data)
        return next
      })
    },
    [connection],
  )

  useEffect(() => {
    const unsubscribers = REMOTE_TYPES.map((type) =>
      connection.on(type, (event) => {
        setState((prev) => {
          // Frontière réseau : le serveur ne connaît pas la forme des actions d'un jeu, non typée ici.
          const remoteEvent = { type, payload: event.payload } as RemoteEvent
          const { state: next, outbox } = applyRemoteEvent(prev, remoteEvent)
          for (const out of outbox) connection.send(out.type, out.data)
          return next
        })
      }),
    )
    const unsubscribePlayerLeft = connection.on(ROOM_EVENT_TYPES.PLAYER_LEFT, () => {
      setState((prev) => applyRemoteEvent(prev, { type: 'PLAYER_LEFT', payload: null }).state)
    })
    return () => {
      for (const unsubscribe of unsubscribers) unsubscribe()
      unsubscribePlayerLeft()
    }
  }, [connection])

  useEffect(() => {
    if (!state.pendingSubmit || submittedRef.current) return
    submittedRef.current = true
    const { shots, hits } = state.pendingSubmit
    ctx.submitScore(computeScore(shots, hits), { shots, hits, winner: state.mySeat })
  }, [ctx, state.mySeat, state.pendingSubmit])

  return {
    state,
    ready: () => dispatchLocal({ kind: 'READY' }),
    fire: (targets: Coord[], bonus?: 'salvo' | 'nuke') => dispatchLocal({ kind: 'FIRE', targets, bonus }),
    useRadar: (zone: Coord[]) => dispatchLocal({ kind: 'RADAR', zone }),
  }
}
