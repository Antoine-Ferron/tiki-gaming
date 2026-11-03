/**
 * Tests unitaires de session.ts : les échanges avec la plateforme, isolés du vrai SDK.
 * Le GameContext est remplacé par des bouchons (réponses préparées) et des simulacres `vi.fn()`
 * dont on vérifie les appels. Aucun accès réseau, aucun Supabase.
 */
import { describe, expect, it, vi } from 'vitest'
import { fire, newRun, parseSave, type Run, type Save } from './expedition'
import { createSaver, loadExpedition, submitRunScore } from './session'
import { deferred } from './test-doubles'

const saveAt = (depth: number): Save => ({ version: 1, run: { ...newRun(1), depth }, stats: parseSave(null).stats })

describe('createSaver', () => {
  it('écrit tout de suite la première sauvegarde', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    await createSaver({ save }, vi.fn())(saveAt(1))
    expect(save).toHaveBeenCalledExactlyOnceWith(saveAt(1))
  })

  it("pendant une écriture, ne garde que la sauvegarde la plus récente et l'écrit ensuite", async () => {
    // Simulacre : la première écriture reste « en cours » jusqu'à ce qu'on la libère.
    const firstWrite = deferred()
    const save = vi.fn().mockReturnValueOnce(firstWrite.promise).mockResolvedValue(undefined)
    const persist = createSaver({ save }, vi.fn())

    const done = persist(saveAt(1))
    void persist(saveAt(2)) // remplacée par la suivante avant d'être écrite
    void persist(saveAt(3))
    expect(save).toHaveBeenCalledTimes(1)

    firstWrite.resolve()
    await done
    expect(save.mock.calls).toEqual([[saveAt(1)], [saveAt(3)]])
  })

  it("signale un échec d'écriture sans bloquer les sauvegardes suivantes", async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error('réseau coupé')).mockResolvedValue(undefined)
    const onError = vi.fn()
    const persist = createSaver({ save }, onError)

    await persist(saveAt(1))
    expect(onError).toHaveBeenCalledOnce()
    await persist(saveAt(2))
    expect(save).toHaveBeenLastCalledWith(saveAt(2))
    expect(onError).toHaveBeenCalledOnce()
  })
})

describe('loadExpedition', () => {
  it('donne une sauvegarde vierge quand le joueur n’en a pas', async () => {
    // Bouchon : loadSave répond toujours null, comme pour un nouveau joueur.
    const loaded = await loadExpedition({ loadSave: async () => null })
    expect(loaded).toEqual({ version: 1, run: null, stats: { runs: 0, bestDepth: 0, bestScore: 0 } })
  })

  it('ignore une sauvegarde abîmée au lieu de faire planter le jeu', async () => {
    const loadSave = vi.fn().mockResolvedValue({ run: { depth: 'trois' }, stats: 'x' })
    const loaded = await loadExpedition({ loadSave })
    expect(loaded.run).toBeNull()
  })

  it('reprend une expédition sauvegardée', async () => {
    const run: Run = fire(newRun(5), 2)
    const loaded = await loadExpedition({ loadSave: async () => JSON.parse(JSON.stringify({ version: 1, run })) })
    expect(loaded.run).toEqual(run)
  })
})

describe('submitRunScore', () => {
  it("n'envoie rien quand aucun étage n'a été réussi", async () => {
    const submitScore = vi.fn()
    expect(await submitRunScore({ submitScore }, newRun(1))).toBe(false)
    expect(submitScore).not.toHaveBeenCalled()
  })

  it('envoie le score avec la profondeur, les tirs et les erreurs', async () => {
    const submitScore = vi.fn().mockResolvedValue(true)
    const run: Run = { ...newRun(1), depth: 3, score: 450, totalProbes: 17, totalErrors: 1 }
    expect(await submitRunScore({ submitScore }, run)).toBe(true)
    expect(submitScore).toHaveBeenCalledExactlyOnceWith(450, { depth: 3, probes: 17, errors: 1 })
  })

  it('renvoie false en invité : le SDK ignore le score', async () => {
    const submitScore = vi.fn().mockResolvedValue(false)
    expect(await submitRunScore({ submitScore }, { ...newRun(1), score: 150 })).toBe(false)
  })

  it("laisse remonter l'erreur réseau pour que l'écran l'affiche", async () => {
    const submitScore = vi.fn().mockRejectedValue(new Error('hors ligne'))
    await expect(submitRunScore({ submitScore }, { ...newRun(1), score: 150 })).rejects.toThrow('hors ligne')
  })
})
