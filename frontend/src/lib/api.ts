// Appels au backend Java (même origine : proxy Vite en dev, rewrites en prod).
import { logger } from './logger'
import type { FieldErrors } from './validation'

/** Erreur renvoyée par le backend : message global et, pour une saisie refusée, message par champ. */
export class ApiError extends Error {
  readonly status: number
  readonly fields: FieldErrors

  constructor(status: number, message: string, fields: FieldErrors = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fields = fields
  }
}

function csrfToken(): string {
  const cookie = document.cookie.split('; ').find((c) => c.startsWith('XSRF-TOKEN='))
  return cookie ? decodeURIComponent(cookie.slice('XSRF-TOKEN='.length)) : ''
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string; fields?: FieldErrors } | null
    const error = new ApiError(res.status, data?.error ?? `Erreur serveur (${res.status})`, data?.fields)
    if (res.status >= 500) logger.error({ err: error, url: res.url }, 'Erreur du backend')
    throw error
  }
  return (res.status === 204 ? undefined : await res.json()) as T
}

async function send(path: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(`/api${path}`, { credentials: 'same-origin', ...init })
  } catch (err) {
    logger.error({ err, path }, 'Backend injoignable')
    throw new ApiError(0, 'Le serveur est injoignable. Vérifie ta connexion et réessaie.')
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  return handle<T>(await send(path, {}))
}

export async function apiPost<T = void>(path: string, body: unknown = {}): Promise<T> {
  const res = await send(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': csrfToken() },
    body: JSON.stringify(body),
  })
  return handle<T>(res)
}

export async function apiDelete<T = void>(path: string): Promise<T> {
  return handle<T>(await send(path, { method: 'DELETE', headers: { 'X-XSRF-TOKEN': csrfToken() } }))
}

/**
 * Répartit une erreur d'appel entre les champs affichés par le formulaire et un message global
 * (utilisé quand aucun des champs en erreur n'est affiché).
 */
export function toFormErrors(err: unknown, shownFields: string[]): { fields: FieldErrors; message: string | null } {
  if (err instanceof ApiError) {
    const shown = Object.keys(err.fields).some((field) => shownFields.includes(field))
    return shown ? { fields: err.fields, message: null } : { fields: {}, message: err.message }
  }
  logger.error({ err }, 'Erreur inattendue')
  return { fields: {}, message: 'Une erreur inattendue est survenue. Réessaie.' }
}
