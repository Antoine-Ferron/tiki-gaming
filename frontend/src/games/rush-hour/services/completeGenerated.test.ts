import { describe, expect, test } from 'vitest'
import { createGameContext } from '../../sdk'
import { FakeScores, fakeDeps } from '../../testing/fakes'
import { completeGenerated } from './completeGenerated'

// Doublures : le vrai GameContext branché sur les fakes en mémoire de la plateforme.
const game = { slug: 'rush-hour', scoreLimits: { max: 20000 } }
const player = { id: 'p1', username: 'tanguy' }

function setup() {
  const scores = new FakeScores(player)
  const deps = fakeDeps({ scores })
  return { scores, deps, ctx: createGameContext(game, player, deps) }
}

describe('completeGenerated : un plateau généré ne compte pas au classement (S4)', () => {
  test('compte le plateau réussi et garde le meilleur score, par difficulté', async () => {
    // Arrange
    const { deps, ctx } = setup()

    // Act
    await completeGenerated(ctx, { difficulty: 'facile', score: 900 })
    await completeGenerated(ctx, { difficulty: 'facile', score: 700 })

    // Assert
    expect(deps.saves.data.get('rush-hour')).toEqual({
      version: 1,
      best: {},
      generated: { facile: { won: 2, best: 900 } },
    })
  })

  test('n’envoie jamais de score au classement', async () => {
    // Arrange
    const { scores, ctx } = setup()

    // Act
    await completeGenerated(ctx, { difficulty: 'difficile', score: 1000 })

    // Assert
    expect(scores.rows).toEqual([])
  })

  test('garde les records des niveaux déjà sauvegardés', async () => {
    // Arrange
    const { deps, ctx } = setup()
    deps.saves.data.set('rush-hour', { version: 1, best: { 1: 800 } })

    // Act
    await completeGenerated(ctx, { difficulty: 'moyen', score: 600 })

    // Assert
    expect(deps.saves.data.get('rush-hour')).toMatchObject({ best: { 1: 800 } })
  })
})
