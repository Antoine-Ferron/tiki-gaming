import { describe, expect, test, vi } from 'vitest'
import { GameError } from '../../errors'
import type { ScoreRepository } from '../../ports'
import { createGameContext } from '../../sdk'
import { FakeScores, fakeDeps } from '../../testing/fakes'
import type { GameState } from '../domain/game'
import { finishGame } from './finishGame'

const game = { slug: 'game-2048' }
const player = { id: 'player-1', username: 'evan' }

function finished(score: number): GameState {
  return {
    grid: [
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 256],
    ],
    score,
    moves: 120,
    status: 'lost',
    continued: false,
  }
}

/** Dummy : un invité n'envoie aucun score, ce dépôt ne doit jamais servir. */
const dummyScores: ScoreRepository = {
  insert: () => Promise.reject(new Error('dummy : ne doit pas être appelé')),
  leaderboard: () => Promise.reject(new Error('dummy : ne doit pas être appelé')),
  best: () => Promise.reject(new Error('dummy : ne doit pas être appelé')),
}

describe('finishGame', () => {
  test('envoie le score avec la plus grande tuile et le nombre de coups (mock de submitScore)', async () => {
    // Arrange
    const ctx = createGameContext(game, player, fakeDeps())
    const submitScore = vi.spyOn(ctx, 'submitScore').mockResolvedValue(true)

    // Act
    await finishGame(ctx, finished(1200))

    // Assert
    expect(submitScore).toHaveBeenCalledOnce()
    expect(submitScore).toHaveBeenCalledWith(1200, { maxTile: 256, moves: 120 })
  })

  test('premier score : il devient le record et part au classement (fakes)', async () => {
    // Arrange
    const scores = new FakeScores(player)
    const deps = fakeDeps({ scores })
    const ctx = createGameContext(game, player, deps)

    // Act
    const result = await finishGame(ctx, finished(1200))

    // Assert
    expect(result).toEqual({ best: 1200, improved: true })
    expect(deps.saves.data.get('game-2048')).toEqual({ version: 1, best: 1200 })
    expect(scores.rows.map((r) => r.score)).toEqual([1200])
  })

  test.each([
    { score: 499, best: 500, improved: false },
    { score: 500, best: 500, improved: false },
    { score: 501, best: 501, improved: true },
  ])('record de 500, partie à $score → record $best', async ({ score, best, improved }) => {
    // Arrange
    const scores = new FakeScores(player)
    const deps = fakeDeps({ scores })
    deps.saves.data.set('game-2048', { version: 1, best: 500 })
    const ctx = createGameContext(game, player, deps)

    // Act
    const result = await finishGame(ctx, finished(score))

    // Assert
    expect(result).toEqual({ best, improved })
    expect(deps.saves.data.get('game-2048')).toEqual({ version: 1, best })
    expect(scores.rows.map((r) => r.score)).toEqual([score])
  })

  test('invité : le record est gardé dans le navigateur, sans passer par le classement (dummy)', async () => {
    // Arrange
    const ctx = createGameContext(game, null, fakeDeps({ scores: dummyScores }))

    // Act
    const result = await finishGame(ctx, finished(800))

    // Assert
    expect(result).toEqual({ best: 800, improved: true })
    expect(await ctx.loadSave()).toEqual({ version: 1, best: 800 })
  })

  test('une sauvegarde illisible est ignorée', async () => {
    // Arrange
    const deps = fakeDeps()
    deps.saves.data.set('game-2048', { record: 'illisible' })
    const ctx = createGameContext(game, player, deps)

    // Act
    const result = await finishGame(ctx, finished(300))

    // Assert
    expect(result).toEqual({ best: 300, improved: true })
  })

  test('score refusé par le classement : l’erreur remonte et le record n’est pas gardé', async () => {
    // Arrange
    const scores = new FakeScores(player)
    const deps = fakeDeps({ scores })
    const ctx = createGameContext(game, player, deps)
    scores.failNext(new GameError('forbidden', 'Score refusé.'))

    // Act
    const finishing = finishGame(ctx, finished(900))

    // Assert
    await expect(finishing).rejects.toMatchObject({ code: 'forbidden', message: 'Score refusé.' })
    expect(deps.saves.data.get('game-2048')).toBeUndefined()
  })

  test('coupure réseau : le joueur est prévenu et le record est gardé', async () => {
    // Arrange
    const scores = new FakeScores(player)
    const deps = fakeDeps({ scores })
    const ctx = createGameContext(game, player, deps)
    scores.failNext(new GameError('network', 'hors ligne'))

    // Act
    const finishing = finishGame(ctx, finished(700))

    // Assert
    await expect(finishing).rejects.toMatchObject({ code: 'queued' })
    expect(deps.saves.data.get('game-2048')).toEqual({ version: 1, best: 700 })
  })
})
