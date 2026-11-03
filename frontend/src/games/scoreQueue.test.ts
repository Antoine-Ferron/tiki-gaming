import { beforeEach, describe, expect, test } from 'vitest'
import { GameError } from './errors'
import { createScoreQueue, MAX_ATTEMPTS, type PendingScore } from './scoreQueue'
import { MemoryStorage } from './testing/fakes'

const KEY = 'tiki:pending-scores:test'
const offline = new GameError('network', 'hors ligne')
const forbidden = new GameError('forbidden', 'refusé')

let storage: MemoryStorage

beforeEach(() => {
  storage = new MemoryStorage()
})

describe('createScoreQueue', () => {
  test('commence vide', () => {
    expect(createScoreQueue(storage, KEY).pending()).toEqual([])
  })

  test('garde un score ajouté avec une première tentative comptée', () => {
    const queue = createScoreQueue(storage, KEY)

    queue.add({ gameSlug: 'clicker', score: 12, metadata: {} })

    expect(queue.pending()).toEqual([{ gameSlug: 'clicker', score: 12, metadata: {}, attempts: 1 }])
  })

  test('survit au rechargement de la page (relu depuis le stockage)', () => {
    createScoreQueue(storage, KEY).add({ gameSlug: 'clicker', score: 1, metadata: {} })

    expect(createScoreQueue(storage, KEY).pending()).toHaveLength(1)
  })

  test('vide la file quand l’envoi réussit et libère la clé', async () => {
    const queue = createScoreQueue(storage, KEY)
    queue.add({ gameSlug: 'clicker', score: 1, metadata: {} })
    const sent: PendingScore[] = []

    await queue.flush(async (p) => void sent.push(p))

    expect(sent.map((p) => p.score)).toEqual([1])
    expect(storage.items.has(KEY)).toBe(false)
  })

  test('garde un score encore hors ligne et compte la tentative', async () => {
    const queue = createScoreQueue(storage, KEY)
    queue.add({ gameSlug: 'clicker', score: 1, metadata: {} })

    await queue.flush(async () => {
      throw offline
    })

    expect(queue.pending()[0].attempts).toBe(2)
  })

  // Frontière : la tentative MAX_ATTEMPTS - 1 est gardée, la MAX_ATTEMPTS-ième abandonne
  test.each([
    [MAX_ATTEMPTS - 2, 1],
    [MAX_ATTEMPTS - 1, 0],
  ])('après %d tentatives, un nouvel échec laisse %d score en attente', async (attempts, expected) => {
    storage.setItem(KEY, JSON.stringify([{ gameSlug: 'clicker', score: 1, metadata: {}, attempts }]))
    const queue = createScoreQueue(storage, KEY)

    await queue.flush(async () => {
      throw offline
    })

    expect(queue.pending()).toHaveLength(expected)
  })

  test('abandonne immédiatement un score refusé définitivement', async () => {
    const queue = createScoreQueue(storage, KEY)
    queue.add({ gameSlug: 'clicker', score: 1, metadata: {} })

    await queue.flush(async () => {
      throw forbidden
    })

    expect(queue.pending()).toEqual([])
  })

  test('n’envoie qu’une fois quand deux flush se chevauchent', async () => {
    const queue = createScoreQueue(storage, KEY)
    queue.add({ gameSlug: 'clicker', score: 1, metadata: {} })
    let calls = 0
    const send = async () => {
      calls++
    }

    await Promise.all([queue.flush(send), queue.flush(send)])

    expect(calls).toBe(1)
  })

  test('relance un nouvel envoi une fois le précédent terminé', async () => {
    const queue = createScoreQueue(storage, KEY)
    let calls = 0
    const send = async () => {
      calls++
    }
    queue.add({ gameSlug: 'clicker', score: 1, metadata: {} })
    await queue.flush(send)
    queue.add({ gameSlug: 'clicker', score: 2, metadata: {} })

    await queue.flush(send)

    expect(calls).toBe(2)
  })

  test('garde un score ajouté pendant un envoi', async () => {
    const queue = createScoreQueue(storage, KEY)
    queue.add({ gameSlug: 'clicker', score: 1, metadata: {} })

    await queue.flush(async () => queue.add({ gameSlug: 'clicker', score: 2, metadata: {} }))

    expect(queue.pending().map((p) => p.score)).toEqual([2])
  })

  test.each([
    'pas du json',
    '{"objet":true}',
    '[{"gameSlug":"x","score":"12","attempts":1}]',
    '[{"gameSlug":1,"score":12,"attempts":1}]',
    '[{"gameSlug":"x","score":12}]',
    '[null]',
  ])('ignore un contenu corrompu : %s', (raw) => {
    storage.setItem(KEY, raw)

    expect(createScoreQueue(storage, KEY).pending()).toEqual([])
  })

  test('écarte une entrée corrompue sans perdre les autres', () => {
    storage.setItem(KEY, '[null, {"gameSlug":"clicker","score":3,"metadata":{},"attempts":1}]')

    expect(
      createScoreQueue(storage, KEY)
        .pending()
        .map((p) => p.score),
    ).toEqual([3])
  })

  test('ne plante pas si le stockage refuse l’écriture', () => {
    const full = new MemoryStorage()
    full.setItem = () => {
      throw new DOMException('QuotaExceededError')
    }

    expect(() => createScoreQueue(full, KEY).add({ gameSlug: 'clicker', score: 1, metadata: {} })).not.toThrow()
  })
})
