import { describe, expect, it, vi } from 'vitest'
import { createGameContext } from '../sdk'
import { fakeDeps, FakeScores } from '../testing/fakes'
import { type Game, LOWER_CATEGORIES, newGame, playCategory, roll, type Sheet, UPPER_CATEGORIES } from './logic'
import { finishGame, loadGame, saveGame } from './session'

const game = { slug: 'yams' }
const player = { id: 'p1', username: 'yanis' }

const complete = (value: number): Sheet =>
  Object.fromEntries([...UPPER_CATEGORIES, ...LOWER_CATEGORIES].map((c) => [c, value]))

// Joueur 1 : 13 cases à 5 = haut 30 (pas de bonus) + bas 35 = 65 ; joueur 2 : 13 cases à 6 = 78
const finished: Game = { sheets: [complete(5), complete(6)], current: 0, turn: null }

describe('finishGame', () => {
  it('envoie une seule fois le total du joueur 1 quand les deux feuilles sont complètes', async () => {
    const scores = new FakeScores(player)
    const ctx = createGameContext(game, player, fakeDeps({ scores }))
    const submitScore = vi.spyOn(ctx, 'submitScore')

    await finishGame(ctx, finished)

    expect(submitScore).toHaveBeenCalledTimes(1)
    expect(scores.rows.map((row) => row.score)).toEqual([65])
  })

  it('n’envoie rien tant que le joueur 2 n’a pas fini', async () => {
    const scores = new FakeScores(player)
    const ctx = createGameContext(game, player, fakeDeps({ scores }))

    expect(await finishGame(ctx, { ...finished, sheets: [complete(5), {}] })).toBeNull()
    expect(scores.rows).toEqual([])
  })

  it('n’enregistre aucun score en invité', async () => {
    const scores = new FakeScores()
    const ctx = createGameContext(game, null, fakeDeps({ scores }))

    await finishGame(ctx, finished)

    expect(scores.rows).toEqual([])
  })
})

describe('sauvegarde', () => {
  it('reprend une partie en cours au même point', async () => {
    const ctx = createGameContext(game, player, fakeDeps())
    const inProgress = roll(
      playCategory(
        roll(newGame(), () => 3),
        'trois',
      ),
      () => 6,
    )

    await saveGame(ctx, inProgress)

    expect(await loadGame(ctx)).toEqual(inProgress)
  })

  it('commence une nouvelle partie sans sauvegarde ou avec une sauvegarde abîmée', async () => {
    const deps = fakeDeps()
    const ctx = createGameContext(game, player, deps)

    expect(await loadGame(ctx)).toEqual(newGame())

    await ctx.save({ sheets: 'abîmée' })
    expect(await loadGame(ctx)).toEqual(newGame())
  })

  it('efface la sauvegarde en fin de partie', async () => {
    const ctx = createGameContext(game, player, fakeDeps())
    await saveGame(ctx, finished)

    await finishGame(ctx, finished)

    expect(await ctx.loadSave()).toBeNull()
  })
})
