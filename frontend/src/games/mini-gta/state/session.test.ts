import { describe, expect, test } from 'vitest'
import { GameError } from '@/games/errors'
import { createGameContext } from '@/games/sdk'
import { fakeDeps, FakeScores } from '@/games/testing/fakes'
import miniGta from '..'
import { newSave } from '../domain/save'
import { createProgressSession } from './session'

const alice = { id: 'p1', username: 'alice' }
const earned = (totalEarned: number) => ({ ...newSave(), money: totalEarned, totalEarned })

function setup(player: typeof alice | null = alice, best: number | null = null) {
  const scores = new FakeScores(alice)
  const deps = fakeDeps({ scores })
  const ctx = createGameContext(miniGta, player, deps)
  const messages: string[] = []
  const session = createProgressSession(ctx, best, (m) => messages.push(m))
  return { scores, deps, ctx, session, messages }
}

describe('session de progression', () => {
  test('sauvegarde la progression et envoie l’argent gagné comme score', async () => {
    const { scores, ctx, session } = setup()

    await session.persist(earned(800))

    expect(await ctx.loadSave()).toMatchObject({ totalEarned: 800 })
    expect(scores.rows.map((r) => r.score)).toEqual([800])
  })

  test('n’envoie le score que s’il bat le dernier envoyé', async () => {
    const { scores, session } = setup(alice, 1000)

    await session.persist(earned(900))
    await session.persist(earned(1500))
    await session.persist(earned(1500))

    expect(scores.rows.map((r) => r.score)).toEqual([1500])
  })

  test('invité : sauvegarde locale, aucun score envoyé', async () => {
    const { scores, ctx, session } = setup(null)

    await session.persist(earned(800))

    expect(await ctx.loadSave()).toMatchObject({ totalEarned: 800 })
    expect(scores.rows).toEqual([])
  })

  test('coupure réseau : le score gardé par la plateforme n’est pas renvoyé en double', async () => {
    const { scores, ctx, session, messages } = setup()
    scores.failNext(new GameError('network', 'Serveur injoignable.'))

    await session.persist(earned(800))
    await session.persist(earned(800))
    await session.persist(earned(900))

    expect(messages).toHaveLength(1)
    expect(await ctx.loadSave()).toMatchObject({ totalEarned: 900 })
    expect(scores.rows.map((r) => r.score)).toEqual([800, 900])
  })

  test('score refusé : signalé, puis renvoyé à la prochaine progression', async () => {
    const { scores, session, messages } = setup()
    scores.failNext(new GameError('forbidden', 'Action refusée.'))

    await session.persist(earned(800))
    await session.persist(earned(800))

    expect(messages).toEqual(['Action refusée.'])
    expect(scores.rows.map((r) => r.score)).toEqual([800])
  })

  test('un échec de sauvegarde est signalé et le score part quand même', async () => {
    const { deps, scores, session, messages } = setup()
    deps.saves.save = async () => {
      throw new GameError('network', 'Sauvegarde impossible.')
    }

    await session.persist(earned(800))

    expect(messages).toEqual(['Sauvegarde impossible.'])
    expect(scores.rows.map((r) => r.score)).toEqual([800])
  })
})
