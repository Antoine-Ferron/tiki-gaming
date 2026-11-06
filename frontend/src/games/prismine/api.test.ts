/**
 * TU — client du serveur arbitre (api.ts). Le transport (apiGet / apiPost de la plateforme) est remplacé
 * par un simulacre : on vérifie les chemins et les corps envoyés, sans réseau.
 */
import { describe, expect, it, vi } from 'vitest'
import { createPrismineApi } from './api'

describe('createPrismineApi', () => {
  it('envoie chaque action au bon endpoint, avec un identifiant encodé', async () => {
    const http = { get: vi.fn().mockResolvedValue({}), post: vi.fn().mockResolvedValue({}) }
    const api = createPrismineApi(http)
    const id = '00000000-0000-0000-0000-000000000001'
    const run = `/games/prismine/runs/${id}`

    await api.startRun()
    await api.getRun(id)
    await api.probe(id, 3)
    await api.validate(id, '..')
    await api.endRun(id)
    await api.getRun('../auth/session')

    expect(http.post.mock.calls).toEqual([
      ['/games/prismine/runs'],
      [`${run}/probes`, { entry: 3 }],
      [`${run}/validation`, { guess: '..' }],
      [`${run}/end`],
    ])
    expect(http.get.mock.calls).toEqual([[run], ['/games/prismine/runs/..%2Fauth%2Fsession']])
  })
})
