import type { Clock } from './domain/stopwatch'

/** Horloge réelle du navigateur, injectée dans la partie (le domaine, lui, ne lit jamais l'heure). */
export const browserClock: Clock = { now: () => Date.now() }
