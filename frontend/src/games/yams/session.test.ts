import { describe, expect, it, vi } from 'vitest'
import { createGameContext } from '../sdk'
import { fakeDeps, FakeScores } from '../testing/fakes'
import { LOWER_CATEGORIES, type Sheet, UPPER_CATEGORIES } from './logic'
import { finishGame } from './session'

const game = { slug: 'yams' }
const player = { id: 'p1', username: 'yanis' }

// Les 13 cases à 5 : haut 30 (pas de bonus) + bas 35 = 65
const fullSheet: Sheet = Object.fromEntries([...UPPER_CATEGORIES, ...LOWER_CATEGORIES].map((c) => [c, 5]))

describe('finishGame', () => {
  it('envoie le total une seule fois quand la feuille est complète', async () => {
    const scores = new FakeScores(player)
    const ctx = createGameContext(game, player, fakeDeps({ scores }))
    const submitScore = vi.spyOn(ctx, 'submitScore')

    await finishGame(ctx, fullSheet)

    expect(submitScore).toHaveBeenCalledTimes(1)
    expect(scores.rows.map((row) => row.score)).toEqual([65])
  })

  it('n’enregistre aucun score en invité', async () => {
    const scores = new FakeScores()
    const ctx = createGameContext(game, null, fakeDeps({ scores }))

    await finishGame(ctx, fullSheet)

    expect(scores.rows).toEqual([])
  })
})
