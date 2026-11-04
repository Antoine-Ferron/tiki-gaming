import { logger } from '@/lib/logger'

/**
 * - network : serveur injoignable ou en panne (5xx), l'action peut être retentée ;
 * - queued : score gardé sur l'appareil après une coupure, il sera renvoyé à la prochaine partie ;
 * - session : jeton expiré ou invalide, il faut se reconnecter ;
 * - forbidden : refusé par les droits (RLS) : mauvais compte, jeu fermé… ;
 * - invalid : donnée refusée (score hors limites, sauvegarde mal formée) ;
 * - not_found : le jeu n'existe pas ou plus en base ;
 * - unknown : tout le reste.
 */
export type GameErrorCode = 'network' | 'queued' | 'session' | 'forbidden' | 'invalid' | 'not_found' | 'unknown'

/** Erreur remontée aux jeux par le SDK : `message` est lisible par le joueur, sans code technique. */
export class GameError extends Error {
  readonly code: GameErrorCode

  constructor(code: GameErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'GameError'
    this.code = code
  }

  /** Vrai si la même action a des chances de réussir plus tard (coupure réseau, serveur indisponible). */
  get retryable(): boolean {
    return this.code === 'network'
  }
}

export const MESSAGES: Record<GameErrorCode, string> = {
  network: 'Le serveur est injoignable. Vérifie ta connexion et réessaie.',
  queued: 'Connexion perdue : ton score est gardé sur cet appareil et sera envoyé à ta prochaine partie.',
  session: 'Ta session a expiré : reconnecte-toi.',
  forbidden: 'Action refusée : vérifie que tu es connecté avec le bon compte et que le jeu est ouvert.',
  invalid: 'Donnée refusée par le serveur.',
  not_found: 'Ce jeu n’est plus disponible.',
  unknown: 'Une erreur inattendue est survenue. Réessaie.',
}

// Codes SQLSTATE (Postgres) et PGRST (PostgREST) renvoyés par supabase-js.
const BY_CODE: Record<string, GameErrorCode> = {
  '42501': 'forbidden', // insufficient_privilege, dont les refus de RLS
  '23514': 'invalid', // check_violation
  '22P02': 'invalid', // invalid_text_representation
  '22003': 'invalid', // numeric_value_out_of_range
  '23503': 'not_found', // foreign_key_violation : jeu absent de public.games
  PGRST301: 'session', // JWT expiré ou invalide
  PGRST303: 'session',
}

const NETWORK_MESSAGE = /failed to fetch|networkerror|load failed|fetch failed|network request failed/i

type ErrorLike = { code?: unknown; message?: unknown; status?: unknown }

/** Statut HTTP générique (REST ou WebSocket) → code d'erreur du SDK, réutilisé par les deux adaptateurs. */
export function codeForStatus(status: number): GameErrorCode | null {
  if (status === 0 || status >= 500) return 'network'
  if (status === 401) return 'session'
  if (status === 403) return 'forbidden'
  if (status === 404) return 'not_found'
  return null
}

/** Statut HTTP éventuellement fourni par l'appelant (réponse supabase-js) ou porté par l'erreur. */
function codeFor(err: ErrorLike, status: number | undefined): GameErrorCode | null {
  if (typeof err.code === 'string' && Object.hasOwn(BY_CODE, err.code)) return BY_CODE[err.code]
  if (NETWORK_MESSAGE.test(String(err.message))) return 'network'
  // NaN quand aucun statut n'est connu : aucune des comparaisons suivantes ne réussit.
  const httpStatus = status ?? (typeof err.status === 'number' ? err.status : Number.NaN)
  return codeForStatus(httpStatus)
}

/** Convertit n'importe quelle erreur (supabase-js, fetch, exception) en GameError avec un message pour le joueur. */
export function toGameError(err: unknown, status?: number): GameError {
  if (err instanceof GameError) return err
  const code = err !== null && typeof err === 'object' ? codeFor(err as ErrorLike, status) : null
  if (code) return new GameError(code, MESSAGES[code], { cause: err })
  // Stryker disable next-line all: journalisation seule, sans effet sur le résultat
  logger.error({ err }, 'Erreur inattendue du SDK des jeux')
  return new GameError('unknown', MESSAGES.unknown, { cause: err })
}

// Messages des navigateurs quand le chunk d'un composant lazy ne se télécharge pas (déploiement, coupure…).
const CHUNK_LOAD_ERROR = /dynamically imported module|importing a module script failed|error loading dynamically/i

/** Vrai si le code d'un jeu (import dynamique) n'a pas pu être téléchargé : seul un rechargement aide. */
export function isChunkLoadError(error: Error): boolean {
  return error.name === 'ChunkLoadError' || CHUNK_LOAD_ERROR.test(error.message)
}
