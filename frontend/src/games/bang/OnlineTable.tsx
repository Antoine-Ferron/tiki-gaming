import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '@/lib/api'
import * as api from './api'
import type { GameView } from './board/view'
import { GameScreen } from './GameScreen'

const POLL_MS = 2000

const messageOf = (err: unknown) => (err instanceof Error ? err.message : 'Une erreur est survenue.')

/** Table en ligne : créer ou rejoindre une table, la démarrer, puis jouer ses tours avec les routes du serveur. */
export function OnlineTable({ accountId }: { accountId: string }) {
  const storageKey = `tiki:bang:table:${accountId}`
  const [code, setCode] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(storageKey)
    } catch {
      return null
    }
  })
  const [joinCode, setJoinCode] = useState('')
  const [view, setView] = useState<GameView | null>(null)
  const latestView = useRef<GameView | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Le POST reste exclusif ; son acquittement suffit si une vue postérieure à la commande est déjà appliquée.
  const acting = useRef<'sending' | number | null>(null)
  const sending = useRef({ command: '', afterRead: 0 })
  const queued = useRef<{ command: string; action: () => Promise<unknown>; view: GameView } | null>(null)
  const latestRead = useRef(0)
  const appliedRead = useRef(0)

  const refresh = useCallback(
    (tableCode: string) => {
      const read = ++latestRead.current
      return api
        .getView(tableCode)
        .then(
          (next) => {
            if (read > appliedRead.current) {
              appliedRead.current = read
              latestView.current = next
              setView(next)
            }
          },
          (err: unknown) => {
            if (read < appliedRead.current) return
            appliedRead.current = read
            // 409 : la partie n'a pas encore démarré, on attend.
            if (err instanceof ApiError && err.status === 409) return
            setError(messageOf(err))
            if (err instanceof ApiError && [401, 403, 404].includes(err.status)) {
              latestView.current = null
              setView(null)
              setCode(null)
              try {
                sessionStorage.removeItem(storageKey)
              } catch {
                // Un stockage refusé ne bloque pas le retour à l'accueil du jeu.
              }
            }
          },
        )
        .finally(() => {
          if (typeof acting.current === 'number' && appliedRead.current > acting.current) acting.current = null
        })
    },
    [storageKey],
  )

  useEffect(() => {
    if (!code) return
    void refresh(code)
    const timer = setInterval(() => void refresh(code), POLL_MS)
    return () => clearInterval(timer)
  }, [code, refresh])

  /** Lance une action, affiche son erreur éventuelle, puis relit la vue. */
  async function run(command: string, action: () => Promise<unknown>) {
    const view = latestView.current
    if (
      command === 'end' &&
      view?.phase === 'DISCARD' &&
      view.hand.length > (view.players.find((player) => player.seat === view.seat)?.health ?? 0)
    )
      return
    if (acting.current !== null) {
      if (
        acting.current === 'sending' &&
        command !== sending.current.command &&
        appliedRead.current > sending.current.afterRead &&
        latestView.current
      ) {
        queued.current ??= { command, action, view: latestView.current }
      }
      return
    }
    acting.current = 'sending'
    sending.current = { command, afterRead: latestRead.current }
    try {
      await action()
      if (command === 'end') {
        // Une fin acceptée invalide les lectures commencées avant son acquittement.
        sending.current.afterRead = latestRead.current
        appliedRead.current = latestRead.current
      }
      setError(null)
    } catch (err) {
      setError(messageOf(err))
    } finally {
      const next = queued.current
      queued.current = null
      const current = latestView.current
      // Le clic retenu appartient au tour, à la phase et au tir affichés à cet instant.
      if (
        next &&
        current &&
        current.code === next.view.code &&
        current.seat === next.view.seat &&
        current.currentSeat === next.view.currentSeat &&
        current.phase === next.view.phase &&
        current.pendingShot?.id === next.view.pendingShot?.id
      ) {
        acting.current = null
        await run(next.command, next.action)
      } else if (code) {
        acting.current = appliedRead.current > sending.current.afterRead ? null : sending.current.afterRead
        await refresh(code)
      } else {
        acting.current = null
      }
    }
  }

  /** Ne mémorise que le code, jamais les mains ou les rôles ; la session serveur décide de la place. */
  function enter(seat: api.TableSeat) {
    try {
      sessionStorage.setItem(storageKey, seat.code)
    } catch {
      // Un stockage refusé ne bloque pas la partie en cours.
    }
    setCode(seat.code)
  }

  return (
    <div className="bang-game">
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!code && (
        <section className="card">
          <h2>Jouer à BANG !</h2>
          <p className="muted">
            Une partie se joue à quatre : crée une table et partage son code, ou rejoins celle d'un ami.
          </p>
          <button type="button" onClick={() => void run('create', async () => enter(await api.createTable()))}>
            Créer une table
          </button>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void run('join', async () => enter(await api.joinTable(joinCode)))
            }}
          >
            <label>
              Code de la table
              <input value={joinCode} onChange={(event) => setJoinCode(event.target.value)} />
            </label>
            <button type="submit">Rejoindre</button>
          </form>
        </section>
      )}
      {code && !view && (
        <section className="card">
          <h2>
            Table <strong>{code}</strong>
          </h2>
          <p className="muted">Partage ce code avec trois autres joueurs, puis démarre la partie.</p>
          <button type="button" onClick={() => void run('start', () => api.startGame(code))}>
            Démarrer la partie
          </button>
        </section>
      )}
      {code && view && (
        <GameScreen
          view={view}
          onDraw={() => void run('draw', () => api.draw(code))}
          onEnd={() => void run('end', () => api.endTurn(code))}
          onDiscard={(cardId) => void run(`discard:${cardId}`, () => api.discard(code, cardId))}
          onShoot={(cardId, targetSeat) =>
            void run(`fire:${cardId}:${targetSeat}`, () => api.fire(code, cardId, targetSeat))
          }
          onDodge={(cardId) =>
            void run(`dodge:${view.pendingShot!.id}:${cardId}`, () => api.dodge(code, view.pendingShot!.id, cardId))
          }
          onAccept={() => void run(`accept:${view.pendingShot!.id}`, () => api.accept(code, view.pendingShot!.id))}
        />
      )}
    </div>
  )
}
