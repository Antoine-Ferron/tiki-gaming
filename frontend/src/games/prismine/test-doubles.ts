/**
 * Doublures de test du GameContext, partagées par session.test.ts et prismine.integration.test.ts.
 * Fichier importé uniquement par les tests : il n'entre jamais dans le bundle du jeu.
 *
 * Vocabulaire (voir TESTS.md) :
 * - bouchon (stub) : renvoie une réponse préparée, sans logique ;
 * - simulacre (mock) : fonction espionne `vi.fn()` dont on vérifie les appels (arguments, nombre, ordre) ;
 * - faux (fake) : implémentation simplifiée mais fonctionnelle, ici un stockage en mémoire qui remplace
 *   Supabase (joueur connecté) ou le localStorage (invité).
 */
import { vi } from 'vitest'
import type { Json } from '@/lib/database.types'
import type { GameContext, LeaderboardEntry, Player } from '../types'

type FakeOptions = {
  /** Joueur connecté, ou null pour un invité (comme le vrai SDK). */
  player?: Player | null
  /** Sauvegarde déjà présente « en base » au lancement du jeu. */
  initialSave?: Json | null
}

/**
 * Faux GameContext : se comporte comme le SDK (invité : score ignoré et `submitScore` renvoie false),
 * mais garde tout en mémoire. Chaque méthode est aussi un simulacre `vi.fn()` pour vérifier les appels.
 * La sauvegarde passe par JSON.stringify / JSON.parse, comme lors d'un aller-retour réseau ou localStorage.
 */
export function createFakeContext({ player = null, initialSave = null }: FakeOptions = {}) {
  let stored: string | null = initialSave === null ? null : JSON.stringify(initialSave)
  const ranked: { score: number; metadata: Json }[] = []

  const ctx = {
    gameSlug: 'prismine',
    player,
    isGuest: player === null,
    submitScore: vi.fn(async (score: number, metadata: Json = {}) => {
      if (!player) return false
      ranked.push({ score, metadata })
      return true
    }),
    getLeaderboard: vi.fn(async (): Promise<LeaderboardEntry[]> => []),
    getMyBest: vi.fn(async (): Promise<LeaderboardEntry | null> => null),
    loadSave: vi.fn(async () => (stored === null ? null : JSON.parse(stored))),
    save: vi.fn(async (data: Json) => {
      stored = JSON.stringify(data)
    }),
    clearSave: vi.fn(async () => {
      stored = null
    }),
  } satisfies GameContext

  return {
    ctx,
    /** Scores réellement classés (vide pour un invité). */
    ranked,
    /** Contenu actuel de la sauvegarde, relu comme le ferait la plateforme. */
    stored: (): unknown => (stored === null ? null : JSON.parse(stored)),
  }
}

/** Promesse résolue à la main : permet de figer une écriture « en cours » pour tester l'ordre des appels. */
export function deferred<T = void>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}
