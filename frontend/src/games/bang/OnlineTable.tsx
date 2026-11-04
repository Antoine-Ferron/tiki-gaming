import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '@/lib/api'
import * as api from './api'
import type { GameView } from './board/view'
import { GameScreen } from './GameScreen'

const POLL_MS = 2000

const messageOf = (err: unknown) => (err instanceof Error ? err.message : 'Une erreur est survenue.')

/** Table en ligne : créer ou rejoindre une table, la démarrer, puis jouer ses tours avec les routes du serveur. */
export function OnlineTable() {
  const [code, setCode] = useState<string | null>(null)
  const [joinCode, setJoinCode] = useState('')
  const [view, setView] = useState<GameView | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async (tableCode: string) => {
    try {
      setView(await api.getView(tableCode))
    } catch (err) {
      // 409 : la partie n'a pas encore démarré, on attend.
      if (!(err instanceof ApiError && err.status === 409)) setError(messageOf(err))
    }
  }, [])

  useEffect(() => {
    if (!code) return
    const timer = setInterval(() => void refresh(code), POLL_MS)
    return () => clearInterval(timer)
  }, [code, refresh])

  /** Lance une action, affiche son erreur éventuelle, puis relit la vue. */
  async function run(action: () => Promise<unknown>) {
    try {
      await action()
      setError(null)
    } catch (err) {
      setError(messageOf(err))
    }
    if (code) await refresh(code)
  }

  /** Entre dans la table, puis lit tout de suite sa vue (la relecture périodique prend ensuite le relais). */
  async function enter(seat: api.TableSeat) {
    setCode(seat.code)
    await refresh(seat.code)
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
        />
      )}
    </div>
  )
}
