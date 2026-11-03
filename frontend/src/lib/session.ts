import { apiGet } from './api'
import { logger } from './logger'

export type AuthUser = { id: string; email: string | null }

type SessionPayload = { user: AuthUser | null; accessToken?: string; expiresAt?: number }

// Marge avant expiration à laquelle on redemande un JWT au backend.
const REFRESH_MARGIN_MS = 60_000

let current: SessionPayload | null = null
let pending: Promise<SessionPayload> | null = null
const listeners = new Set<(user: AuthUser | null) => void>()

function setCurrent(session: SessionPayload) {
  current = session
  listeners.forEach((listener) => listener(session.user))
}

/** Interroge le backend : utilisateur connecté (session HTTP) + JWT Supabase. */
export function fetchSession(): Promise<SessionPayload> {
  pending ??= apiGet<SessionPayload>('/auth/session')
    .then((session) => {
      setCurrent(session)
      return session
    })
    .finally(() => {
      pending = null
    })
  return pending
}

export function clearSession() {
  setCurrent({ user: null })
}

export function onSessionChange(listener: (user: AuthUser | null) => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Jeton passé à supabase-js ; null = requêtes anonymes (clé anon). */
export async function getAccessToken(): Promise<string | null> {
  try {
    if (!current || (current.user && (current.expiresAt ?? 0) - Date.now() < REFRESH_MARGIN_MS)) {
      await fetchSession()
    }
  } catch (err) {
    logger.warn({ err }, 'Session indisponible, requêtes en anonyme')
    return null
  }
  return current?.accessToken ?? null
}
