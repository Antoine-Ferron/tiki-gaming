import { describe, expect, test } from 'vitest'
import { GameError, isChunkLoadError, MESSAGES, toGameError } from './errors'

describe('toGameError', () => {
  test('laisse passer une GameError telle quelle', () => {
    const error = new GameError('invalid', 'Score refusé')

    expect(toGameError(error)).toBe(error)
  })

  test.each([
    ['42501', 'forbidden'],
    ['23514', 'invalid'],
    ['22P02', 'invalid'],
    ['22003', 'invalid'],
    ['23503', 'not_found'],
    ['PGRST301', 'session'],
    ['PGRST303', 'session'],
  ])('traduit le code %s en %s, avec un message sans code technique', (code, expected) => {
    const error = toGameError({ code, message: 'new row violates row-level security policy' })

    expect(error.code).toBe(expected)
    expect(error.message).toBe(MESSAGES[error.code])
    expect(error.message).not.toContain(code)
  })

  test.each([
    'TypeError: Failed to fetch',
    'NetworkError when attempting to fetch resource.',
    'Load failed',
    'fetch failed',
  ])('reconnaît une coupure réseau : %s', (message) => {
    expect(toGameError(new TypeError(message)).code).toBe('network')
  })

  // Frontières des statuts HTTP : 499 (pas une panne serveur), 500, 0 (pas de réponse)
  test.each([
    [0, 'network'],
    [499, 'unknown'],
    [500, 'network'],
    [503, 'network'],
    [401, 'session'],
    [403, 'forbidden'],
  ])('statut HTTP %d → %s', (status, expected) => {
    expect(toGameError({ code: '', message: 'erreur' }, status).code).toBe(expected)
  })

  test.each<[unknown, string]>([
    ['toString', 'code hérité de Object.prototype'],
    [42501, 'code numérique'],
  ])('ignore %s (%s)', (code) => {
    expect(toGameError({ code }).code).toBe('unknown')
  })

  test('ignore un statut porté par l’erreur s’il n’est pas numérique', () => {
    expect(toGameError({ status: '503' }).code).toBe('unknown')
  })

  test('lit aussi le statut porté par l’erreur', () => {
    expect(toGameError({ status: 502 }).code).toBe('network')
  })

  test('le code connu prime sur le statut HTTP', () => {
    expect(toGameError({ code: '42501' }, 500).code).toBe('forbidden')
  })

  test.each([new Error('boom'), 'texte', null, undefined, 42, { code: 'XX000' }])('%s → unknown', (err) => {
    const error = toGameError(err)

    expect(error.code).toBe('unknown')
    expect(error.message).toBe(MESSAGES.unknown)
  })

  test.each([{ code: '42501' }, new Error('boom')])('garde l’erreur d’origine en cause : %s', (cause) => {
    expect(toGameError(cause).cause).toBe(cause)
  })
})

describe('MESSAGES', () => {
  test.each(Object.entries(MESSAGES))('%s : message distinct, phrase complète', (_, message) => {
    expect(message).toMatch(/^[A-Z].{15,}\.$/)
    expect(Object.values(MESSAGES).filter((m) => m === message)).toHaveLength(1)
  })

  test('une GameError se reconnaît à son nom dans les logs', () => {
    expect(new GameError('invalid', '').name).toBe('GameError')
  })
})

describe('GameError.retryable', () => {
  test.each([
    ['network', true],
    ['queued', false],
    ['forbidden', false],
    ['invalid', false],
    ['unknown', false],
  ] as const)('%s → %s', (code, expected) => {
    expect(new GameError(code, '').retryable).toBe(expected)
  })
})

describe('isChunkLoadError', () => {
  test.each([
    'Failed to fetch dynamically imported module: /assets/ClickerGame.js',
    'Importing a module script failed.',
    'error loading dynamically imported module',
  ])('reconnaît « %s »', (message) => {
    expect(isChunkLoadError(new TypeError(message))).toBe(true)
  })

  test('reconnaît une ChunkLoadError par son nom', () => {
    const error = new Error('Loading chunk 3 failed')
    error.name = 'ChunkLoadError'

    expect(isChunkLoadError(error)).toBe(true)
  })

  test('ignore une erreur ordinaire', () => {
    expect(isChunkLoadError(new Error('Cannot read properties of undefined'))).toBe(false)
  })
})
