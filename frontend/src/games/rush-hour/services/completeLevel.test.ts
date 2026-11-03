import { describe, expect, test } from 'vitest'
import { createGameContext } from '../../sdk'
import { FakeScores, fakeDeps } from '../../testing/fakes'
import type { Move } from '../domain/board'
import { completeLevel } from './completeLevel'

// Doublures : le GameContext est le vrai, branché sur les Fakes en mémoire de la plateforme
// (pas de Supabase, pas de réseau). On vérifie l'état final : sauvegarde et scores reçus.
const game = { slug: 'rush-hour', scoreLimits: { max: 20000 } }
const player = { id: 'player-1', username: 'tanguy' }

/** Une partie de `count` coups (leur contenu n'est pas vérifié par ce service). */
function moves(count: number): Move[] {
  return Array.from({ length: count }, () => ({ id: 'X', delta: 1 }))
}

describe('completeLevel', () => {
  test('premier record : sauvegarde la progression et envoie le score total avec la partie en métadonnées', async () => {
    // Arrange
    const scores = new FakeScores(player)
    const deps = fakeDeps({ scores })
    const ctx = createGameContext(game, player, deps)

    // Act
    await completeLevel(ctx, { level: 1, optimal: 2, moves: moves(2), hintsUsed: 0, durationMs: 7500 })

    // Assert
    expect(deps.saves.data.get('rush-hour')).toEqual({ version: 1, best: { 1: 1000 } })
    expect(scores.rows).toEqual([
      {
        gameSlug: 'rush-hour',
        userId: 'player-1',
        username: 'tanguy',
        score: 1000,
        metadata: { level: 1, levelScore: 1000, hintsUsed: 0, durationMs: 7500, moves: moves(2) },
      },
    ])
  })

  test('envoie la somme des records de tous les niveaux', async () => {
    // Arrange
    const scores = new FakeScores(player)
    const deps = fakeDeps({ scores })
    deps.saves.data.set('rush-hour', { version: 1, best: { 1: 1000, 2: 800 } })
    const ctx = createGameContext(game, player, deps)

    // Act : niveau 3 en 1 coup de trop → 950
    await completeLevel(ctx, { level: 3, optimal: 5, moves: moves(6), hintsUsed: 0, durationMs: 1000 })

    // Assert
    expect(scores.rows.map((r) => r.score)).toEqual([2750])
  })

  // Record de 800 : seul un score strictement meilleur est sauvegardé et envoyé
  test.each([
    { label: 'moins bon (750)', moveCount: 15, saved: 800, sent: [] },
    { label: 'égal (800)', moveCount: 14, saved: 800, sent: [] },
    { label: 'meilleur (850)', moveCount: 13, saved: 850, sent: [850] },
  ])('record de 800, score $label', async ({ moveCount, saved, sent }) => {
    // Arrange
    const scores = new FakeScores(player)
    const deps = fakeDeps({ scores })
    deps.saves.data.set('rush-hour', { version: 1, best: { 1: 800 } })
    const ctx = createGameContext(game, player, deps)

    // Act : minimum de 10 coups
    await completeLevel(ctx, { level: 1, optimal: 10, moves: moves(moveCount), hintsUsed: 0, durationMs: 1000 })

    // Assert
    expect(deps.saves.data.get('rush-hour')).toEqual({ version: 1, best: { 1: saved } })
    expect(scores.rows.map((r) => r.score)).toEqual(sent)
  })

  test('invité : la progression est sauvegardée en local et aucun score n’est enregistré', async () => {
    // Arrange
    const scores = new FakeScores(player)
    const ctx = createGameContext(game, null, fakeDeps({ scores }))

    // Act
    await completeLevel(ctx, { level: 1, optimal: 2, moves: moves(2), hintsUsed: 0, durationMs: 1000 })

    // Assert
    expect(await ctx.loadSave()).toEqual({ version: 1, best: { 1: 1000 } })
    expect(scores.rows).toEqual([])
  })

  test('une sauvegarde corrompue est ignorée : on repart d’une progression vide', async () => {
    // Arrange
    const deps = fakeDeps()
    deps.saves.data.set('rush-hour', { records: 'illisible' })
    const ctx = createGameContext(game, player, deps)

    // Act
    await completeLevel(ctx, { level: 1, optimal: 2, moves: moves(2), hintsUsed: 0, durationMs: 1000 })

    // Assert
    expect(deps.saves.data.get('rush-hour')).toEqual({ version: 1, best: { 1: 1000 } })
  })
})
