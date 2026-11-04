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
  const [error, setError] = useState<string | null>(null)
  const acting = useRef(false)
  const latestRead = useRef(0)

  const refresh = useCallback(
    async (tableCode: string) => {
      const read = ++latestRead.current
      try {
        const next = await api.getView(tableCode)
        if (read === latestRead.current) setView(next)
      } catch (err) {
        if (read !== latestRead.current) return
        // 409 : la partie n'a pas encore démarré, on attend.
        if (err instanceof ApiError && err.status === 409) return
        setError(messageOf(err))
        if (err instanceof ApiError && (err.status === 403 || err.status === 404)) {
          setView(null)
          setCode(null)
          try {
            sessionStorage.removeItem(storageKey)
          } catch {
            // Un stockage refusé ne bloque pas le retour à l'accueil du jeu.
          }
        }
      }
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
  async function run(action: () => Promise<unknown>) {
    if (acting.current) return
    acting.current = true
    try {
      await action()
      setError(null)
    } catch (err) {
      setError(messageOf(err))
    } finally {
      if (code) await refresh(code)
      acting.current = false
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
          <button type="button" onClick={() => void run(async () => enter(await api.createTable()))}>
            Créer une table
          </button>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void run(async () => enter(await api.joinTable(joinCode)))
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
          <button type="button" onClick={() => void run(() => api.startGame(code))}>
            Démarrer la partie
          </button>
        </section>
      )}
      {code && view && (
        <GameScreen
          view={view}
          onDraw={() => void run(() => api.draw(code))}
          onEnd={() => void run(() => api.endTurn(code))}
          onDiscard={(cardId) => void run(() => api.discard(code, cardId))}
          onShoot={(cardId, targetSeat) => void run(() => api.fire(code, cardId, targetSeat))}
          onDodge={(cardId) => void run(() => api.dodge(code, view.pendingShot!.id, cardId))}
          onAccept={() => void run(() => api.accept(code, view.pendingShot!.id))}
        />
      )}
    </div>
  )
}
