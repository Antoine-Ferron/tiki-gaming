import { afterEach, describe, expect, test, vi } from 'vitest'
import { GameError, MESSAGES } from '../../errors'
import { logger } from '@/lib/logger'
import type { GameContext } from '../../types'
import { PX_PER_METER } from '../domain/game'
import { aGame } from '../testing/builders'
import { finishGame } from './finish'

// Le GameContext est une doublure faite main : seul submitScore compte ici.
// Spy (vi.fn) pour vérifier l'appel, Stub (mockRejectedValue / mockResolvedValue) pour imposer la réponse.
function contextWith(submitScore: GameContext['submitScore']): GameContext {
  return { submitScore } as GameContext
}

const ended = aGame({ peakY: 150 * PX_PER_METER, vanilla: 1, over: 'fall' })

afterEach(() => {
  vi.restoreAllMocks()
})

describe('fin de partie sur la plateforme (EF-8)', () => {
  test('envoie le score une seule fois, avec la hauteur, la vanille, la cause et la durée (EF-8.1)', async () => {
    // Arrange
    const submitScore = vi.fn<GameContext['submitScore']>().mockResolvedValue(true)
    // Act
    const finish = await finishGame(ended, contextWith(submitScore), 42_000)
    // Assert
    expect(submitScore).toHaveBeenCalledTimes(1)
    expect(submitScore).toHaveBeenCalledWith(160, { heightMeters: 150, vanilla: 1, cause: 'fall', durationMs: 42_000 })
    expect(finish).toEqual({ score: 160, message: null })
  })

  test('invite un invité à se connecter quand le score ne part pas au classement (EF-8.3)', async () => {
    const finish = await finishGame(ended, contextWith(vi.fn().mockResolvedValue(false)), 42_000)

    expect(finish).toEqual({ score: 160, message: 'Connecte-toi pour apparaître au classement.' })
  })

  test.each([
    { cas: 'score mis en attente', erreur: new GameError('queued', MESSAGES.queued), message: MESSAGES.queued },
    { cas: 'session expirée', erreur: new GameError('session', MESSAGES.session), message: MESSAGES.session },
    { cas: 'erreur inattendue', erreur: new Error('boom'), message: MESSAGES.unknown },
  ])(
    '$cas : affiche le message au joueur sans rejeter, pour qu’il puisse rejouer (EF-8.5)',
    async ({ erreur, message }) => {
      vi.spyOn(logger, 'error').mockImplementation(() => undefined)

      const finish = await finishGame(ended, contextWith(vi.fn().mockRejectedValue(erreur)), 42_000)

      expect(finish).toEqual({ score: 160, message })
    },
  )
})
