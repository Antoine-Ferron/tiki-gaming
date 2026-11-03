/**
 * Doublures de test du GameContext et de l'API du serveur, partagées par les tests unitaires et
 * prismine.integration.test.ts.
 * Fichier importé uniquement par les tests : il n'entre jamais dans le bundle du jeu.
 *
 * Vocabulaire (voir TESTS.md) :
 * - bouchon (stub) : renvoie une réponse préparée, sans logique ;
 * - simulacre (mock) : fonction espionne `vi.fn()` dont on vérifie les appels (arguments, nombre, ordre) ;
 * - faux (fake) : implémentation simplifiée mais fonctionnelle, ici un stockage en mémoire qui remplace
 *   Supabase (joueur connecté) ou le localStorage (invité).
 */
import { vi, type Mock } from 'vitest'
import type { Json } from '@/lib/database.types'
import type { GameContext, LeaderboardEntry, Player } from '../types'
import type { PrismineApi, RunView } from './api'

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

/** Expédition telle que le serveur la renvoie, avec des valeurs par défaut (étage 1, lampe pleine). */
export function runView(overrides: Partial<RunView> = {}): RunView {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    depth: 1,
    size: 6,
    prisms: 3,
    obsidians: 0,
    colors: [1],
    oil: 20,
    score: 0,
    floorErrors: 0,
    totalProbes: 0,
    totalErrors: 0,
    probes: [],
    ...overrides,
  }
}

/**
 * Bouchon de l'API du serveur arbitre : chaque méthode est un simulacre `vi.fn()` qui échoue tant que le
 * test ne lui a pas préparé de réponse. Le front ne parle jamais au vrai serveur Java dans les tests.
 */
export function stubApi(overrides: Partial<Record<keyof PrismineApi, Mock>> = {}) {
  const unexpected = (name: string) => vi.fn().mockRejectedValue(new Error(`appel inattendu : ${name}`))
  return {
    startRun: unexpected('startRun'),
    getRun: unexpected('getRun'),
    probe: unexpected('probe'),
    validate: unexpected('validate'),
    endRun: unexpected('endRun'),
    ...overrides,
  } satisfies PrismineApi
}
