import { describe, expect, test, vi } from 'vitest'
import * as z from 'zod/mini'
import { GameError } from './errors'
import { createGameContext } from './sdk'
import {
  FakeRealtime,
  type FakeRealtimeConnection,
  FakeSaves,
  FakeScores,
  fakeDeps,
  MemoryStorage,
} from './testing/fakes'

const game = { slug: 'clicker', scoreLimits: { max: 300 } }
const player = { id: 'player-1', username: 'alice' }
const offline = new GameError('network', 'hors ligne')

describe('contexte joueur', () => {
  test('enregistre un score valide', async () => {
    const scores = new FakeScores(player)
    const ctx = createGameContext(game, player, fakeDeps({ scores }))

    await expect(ctx.submitScore(42, { durationMs: 10_000 })).resolves.toBe(true)

    expect(scores.rows).toEqual([
      { gameSlug: 'clicker', userId: 'player-1', username: 'alice', score: 42, metadata: { durationMs: 10_000 } },
    ])
  })

  test.each([-1, 301, 1.5])('refuse %d sans rien envoyer', async (score) => {
    const scores = new FakeScores(player)
    const ctx = createGameContext(game, player, fakeDeps({ scores }))

    await expect(ctx.submitScore(score)).rejects.toMatchObject({ code: 'invalid' })
    expect(scores.rows).toEqual([])
  })

  test('accepte exactement la limite du jeu', async () => {
    const ctx = createGameContext(game, player, fakeDeps())

    await expect(ctx.submitScore(300)).resolves.toBe(true)
  })

  test('hors ligne : garde le score et prévient le joueur, puis l’envoie à la partie suivante', async () => {
    const scores = new FakeScores(player)
    const deps = fakeDeps({ scores })
    const ctx = createGameContext(game, player, deps)
    scores.failNext(offline)

    await expect(ctx.submitScore(10)).rejects.toMatchObject({ code: 'queued', cause: offline })
    expect(scores.rows).toEqual([])
    expect(deps.storage?.getItem('tiki:pending-scores:player-1')).toContain('"score":10')

    await ctx.submitScore(20)

    expect(scores.rows.map((r) => r.score)).toEqual([10, 20])
  })

  test('renvoie les scores en attente dès l’ouverture du jeu', async () => {
    const storage = new MemoryStorage()
    const scores = new FakeScores(player)
    scores.failNext(offline)
    await createGameContext(game, player, fakeDeps({ scores, storage }))
      .submitScore(10)
      .catch(() => {})

    createGameContext(game, player, fakeDeps({ scores, storage }))
    await vi.waitFor(() => expect(scores.rows.map((r) => r.score)).toEqual([10]))
  })

  test('un refus définitif remonte tel quel, sans mise en attente', async () => {
    const scores = new FakeScores(player)
    const storage = new MemoryStorage()
    const ctx = createGameContext(game, player, fakeDeps({ scores, storage }))
    scores.failNext(new GameError('forbidden', 'refusé'))

    await expect(ctx.submitScore(10)).rejects.toMatchObject({ code: 'forbidden' })
    expect(storage.items.size).toBe(0)
  })

  test('sans stockage local, une coupure remonte comme erreur réseau', async () => {
    const scores = new FakeScores(player)
    const ctx = createGameContext(game, player, fakeDeps({ scores, storage: null }))
    scores.failNext(offline)

    await expect(ctx.submitScore(10)).rejects.toMatchObject({ code: 'network' })
  })

  test('traduit une erreur brute d’adaptateur', async () => {
    const scores = new FakeScores(player)
    const ctx = createGameContext(game, player, fakeDeps({ scores }))
    scores.failNext({ code: '42501', message: 'new row violates row-level security policy' })

    await expect(ctx.submitScore(10)).rejects.toBeInstanceOf(GameError)
  })

  test('classement et meilleur score passent par le dépôt', async () => {
    const scores = new FakeScores(player)
    const ctx = createGameContext(game, player, fakeDeps({ scores }))
    await ctx.submitScore(5)
    await ctx.submitScore(9)

    expect((await ctx.getLeaderboard()).map((e) => e.best_score)).toEqual([9])
    expect(await ctx.getMyBest()).toMatchObject({ best_score: 9, games_played: 2 })
  })

  test('sauvegarde, recharge et efface la partie du joueur', async () => {
    const saves = new FakeSaves()
    const ctx = createGameContext(game, player, fakeDeps({ playerSaves: () => saves }))

    await ctx.save({ totalClicks: 3 })
    expect(await ctx.loadSave()).toEqual({ totalClicks: 3 })

    await ctx.clearSave()
    expect(await ctx.loadSave()).toBeNull()
  })
})

describe('sauvegarde validée par schéma', () => {
  const schema = z.object({ totalClicks: z.number() })

  test('renvoie une sauvegarde conforme', async () => {
    const deps = fakeDeps()
    await deps.saves.save('clicker', { totalClicks: 7 })

    await expect(createGameContext(game, player, deps).loadSave(schema)).resolves.toEqual({ totalClicks: 7 })
  })

  test.each([{ totalClicks: '7' }, { autre: 1 }, [1, 2], 'texte'])(
    'ignore une sauvegarde non conforme : %j',
    async (data) => {
      const deps = fakeDeps()
      await deps.saves.save('clicker', data)

      await expect(createGameContext(game, player, deps).loadSave(schema)).resolves.toBeNull()
    },
  )

  test('sans sauvegarde, renvoie null sans consulter le schéma', async () => {
    const safeParse = vi.fn()

    await expect(createGameContext(game, player, fakeDeps()).loadSave({ safeParse })).resolves.toBeNull()
    expect(safeParse).not.toHaveBeenCalled()
  })
})

describe('contexte invité', () => {
  test('n’enregistre aucun score mais valide quand même', async () => {
    const scores = new FakeScores()
    const ctx = createGameContext(game, null, fakeDeps({ scores }))

    await expect(ctx.submitScore(10)).resolves.toBe(false)
    await expect(ctx.submitScore(-1)).rejects.toMatchObject({ code: 'invalid' })
    expect(scores.rows).toEqual([])
    expect(ctx).toMatchObject({ isGuest: true, player: null })
    expect(await ctx.getMyBest()).toBeNull()
  })

  test('lit le classement public', async () => {
    const scores = new FakeScores(player)
    await scores.insert('clicker', 50, {})

    const entries = await createGameContext(game, null, fakeDeps({ scores })).getLeaderboard()

    expect(entries.map((e) => e.username)).toEqual(['alice'])
  })

  test('sauvegarde sur l’appareil, par jeu', async () => {
    const storage = new MemoryStorage()
    const ctx = createGameContext(game, null, fakeDeps({ storage }))

    await ctx.save({ totalClicks: 2 })

    expect(storage.getItem('tiki:guest-save:clicker')).toBe('{"totalClicks":2}')
    expect(await ctx.loadSave()).toEqual({ totalClicks: 2 })
    await ctx.clearSave()
    expect(await ctx.loadSave()).toBeNull()
  })

  test('une sauvegarde locale illisible donne null', async () => {
    const storage = new MemoryStorage()
    storage.setItem('tiki:guest-save:clicker', '{pas du json')

    await expect(createGameContext(game, null, fakeDeps({ storage })).loadSave()).resolves.toBeNull()
  })

  test('sans stockage (navigation privée), la partie continue sans sauvegarde', async () => {
    const ctx = createGameContext(game, null, fakeDeps({ storage: null }))

    await expect(ctx.save({ totalClicks: 1 })).resolves.toBeUndefined()
    await expect(ctx.loadSave()).resolves.toBeNull()
    await expect(ctx.clearSave()).resolves.toBeUndefined()
  })

  test('un stockage qui refuse l’écriture ne bloque pas la partie', async () => {
    const storage = new MemoryStorage()
    const refuse = () => {
      throw new DOMException('QuotaExceededError')
    }
    storage.setItem = refuse
    storage.removeItem = refuse

    const ctx = createGameContext(game, null, fakeDeps({ storage }))

    await expect(ctx.save({ totalClicks: 1 })).resolves.toBeUndefined()
    await expect(ctx.clearSave()).resolves.toBeUndefined()
  })
})

describe('temps réel', () => {
  test('ctx.realtime est scopé sur le jeu courant', () => {
    const realtime = new FakeRealtime()
    const deps = fakeDeps({ realtime: vi.fn().mockReturnValue(realtime) })

    const ctx = createGameContext(game, player, deps)

    expect(ctx.realtime).toBe(realtime)
    expect(deps.realtime).toHaveBeenCalledWith('clicker')
  })

  test('un jeu invité a aussi accès au temps réel', () => {
    const realtime = new FakeRealtime()

    const ctx = createGameContext(game, null, fakeDeps({ realtime: () => realtime }))

    expect(ctx.realtime).toBe(realtime)
  })

  test('crée une salle et la rejoint depuis un autre compte', async () => {
    const realtime = new FakeRealtime()
    const ctx = createGameContext(game, player, fakeDeps({ realtime: () => realtime }))

    const created = await ctx.realtime.createRoom(4)
    expect(created.seat).toBe(1)
    expect(created.playerCount).toBe(1)

    const joined = await realtime.joinRoom(created.code)
    expect(joined.code).toBe(created.code)
  })

  test('diffuse un évènement à tous les abonnés de la salle', async () => {
    const realtime = new FakeRealtime()
    const ctx = createGameContext(game, player, fakeDeps({ realtime: () => realtime }))
    const connection = (await ctx.realtime.createRoom()) as FakeRealtimeConnection

    const received = vi.fn()
    connection.on('COUP_JOUE', received)
    connection.send('COUP_JOUE', { case: 'A1' }, 'action-1')
    connection.emit('COUP_JOUE', { case: 'A1' })

    expect(connection.sent).toEqual([{ type: 'COUP_JOUE', data: { case: 'A1' }, actionId: 'action-1' }])
    expect(received).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'COUP_JOUE', payload: { case: 'A1' }, code: connection.code }),
    )
  })

  test('une création refusée par le serveur rejette avec une GameError', async () => {
    const realtime = new FakeRealtime()
    realtime.failNextCreate(new GameError('forbidden', 'Jeu fermé.'))
    const ctx = createGameContext(game, player, fakeDeps({ realtime: () => realtime }))

    await expect(ctx.realtime.createRoom()).rejects.toMatchObject({ code: 'forbidden' })
  })
})
