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

const REMOTE_TYPES = ['READY', 'FIRE', 'FIRE_RESULT', 'RADAR', 'RADAR_RESULT', 'GAME_ABANDONED'] as const

/**
 * Câble le réducteur pur de `network.ts` sur une `RealtimeConnection` : vide son `outbox` vers `connection.send`,
 * convertit les évènements reçus en `RemoteEvent`, et soumet le score une seule fois à la victoire. Ne prend
 * aucune décision de protocole elle-même — tout est dans `network.ts`.
 */
export function useNetGame(
  connection: RealtimeConnection,
  myFleet: PlacedShip[],
  augmented: boolean,
  ctx: GameContext,
  resume?: NetState,
) {
  const [state, setState] = useState<NetState>(() => resume ?? createNetState(connection.seat, myFleet, augmented))
  const submittedRef = useRef(false)
  const sentInitialReadyRef = useRef(false)

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
    // Au mieux : la victoire reste acquise localement même si la soumission échoue (pas de réseau, compte
    // invité...), rien d'autre à faire ici (voir le même choix pour la sauvegarde best-effort de mini-gta).
    ctx.submitScore(computeScore(shots, hits), { shots, hits, winner: state.mySeat }).catch(() => {})
  }, [ctx, state.mySeat, state.pendingSubmit])

  // Envoyé une seule fois, au montage : ma flotte est déjà placée à ce stade. S'il arrive avant que
  // l'adversaire n'ait rejoint la salle, `network.ts` le renvoie une dernière fois dès qu'il reçoit le
  // sien (voir le commentaire du cas 'READY'), pour qu'il finisse par arriver quel que soit l'ordre. Un
  // simple envoi réseau, sans mise à jour d'état locale (le réducteur ne change jamais l'état pour ce cas) :
  // appeler `connection.send` directement, plutôt que `dispatchLocal`, évite un rendu superflu dans l'effet.
  // Le garde par ref (et non un simple effet à dépendances vides) survit au montage-démontage-remontage
  // que <StrictMode> impose en développement : sans lui, ce READY non marqué `confirm` partirait deux fois,
  // et sa seconde copie, reçue après que les deux camps ont déjà basculé en bataille, se ferait passer pour
  // un rechargement de page (voir le cas 'READY' de `network.ts`) alors que la partie vient à peine de commencer.
  //
  // Si on reprend une partie déjà engagée (`resume`, après un rechargement — voir BatailleNavaleGame.tsx),
  // ce READY ne doit PAS repartir une fois la bataille commencée : ce serait exactement le même message
  // qu'un adversaire qui recharge sa page, et déclencherait à tort un abandon chez l'adversaire alors que la
  // connexion au socle reste la même (même compte, même siège — voir l'investigation du socle générique :
  // aucun évènement de déconnexion n'est émis par un simple rechargement). En revanche, en reprise pendant le
  // placement (ma flotte déjà posée, toujours en attente), le renvoyer reste utile et sans danger : c'est
  // l'un des deux envois normaux du protocole, idempotent côté réducteur.
  useEffect(() => {
    if (sentInitialReadyRef.current) return
    sentInitialReadyRef.current = true
    if (resume && resume.phase !== 'placement') return
    connection.send('READY', { by: connection.seat })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `resume` n'est lu qu'à ce tout premier montage (garde par ref).
  }, [connection])

  return {
    state,
    fire: (targets: Coord[], bonus?: 'salvo' | 'nuke') => dispatchLocal({ kind: 'FIRE', targets, bonus }),
    useRadar: (zone: Coord[]) => dispatchLocal({ kind: 'RADAR', zone }),
  }
}
