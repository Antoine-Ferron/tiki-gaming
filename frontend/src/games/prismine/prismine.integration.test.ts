/**
 * TI — front : les vrais modules (expedition → session) parlent à un faux GameContext (sauvegarde en
 * mémoire, en JSON, comme Supabase ou le localStorage) et à un bouchon du serveur arbitre. On vérifie ce
 * que la plateforme reçoit : sauvegardes, reprise après rechargement, et qu'aucun score ne part du
 * navigateur (c'est le serveur Java qui le classe).
 */
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api'
import { endStats, guessFor } from './expedition'
import { createSaver, loadExpedition, resumeRun } from './session'
import { createFakeContext, runView, stubApi } from './test-doubles'

const PLAYER = { id: 'joueur-1', username: 'clement' }
const ID = '00000000-0000-0000-0000-000000000001'

describe('expédition d’un joueur connecté', () => {
  it('sauvegarde l’expédition, la reprend après rechargement, puis ne garde que les statistiques', async () => {
    const { ctx, stored } = createFakeContext({ player: PLAYER })
    const onSaveError = vi.fn()
    const persist = createSaver(ctx, onSaveError)

    // Ouverture du jeu : aucune sauvegarde, le serveur crée l'expédition.
    const api = stubApi({ startRun: vi.fn().mockResolvedValue(runView({ id: ID })) })
    let save = await loadExpedition(ctx)
    expect(await resumeRun(api, save)).toBeNull()
    const run = await api.startRun()
    save = { ...save, runId: run.id, guess: guessFor(save, run) }
    await persist(save)
    expect(stored()).toMatchObject({ version: 2, runId: ID })

    // Rechargement de la page : la sauvegarde donne l'identifiant, le serveur rend l'expédition.
    const atDepth3 = runView({ id: ID, depth: 3, size: 7, score: 450 })
    api.getRun.mockResolvedValue(atDepth3)
    const reloaded = await loadExpedition(ctx)
    expect(await resumeRun(api, reloaded)).toEqual(atDepth3)
    expect(api.getRun).toHaveBeenCalledExactlyOnceWith(ID)

    // Fin d'expédition : le score est classé par le serveur, le navigateur ne garde que les statistiques.
    await persist(endStats(reloaded, atDepth3))
    expect(stored()).toEqual({ version: 2, runId: null, guess: '', stats: { runs: 1, bestDepth: 3, bestScore: 450 } })
    expect(ctx.submitScore).not.toHaveBeenCalled()
    expect(onSaveError).not.toHaveBeenCalled()
  })
})

describe('reprise impossible', () => {
  it('repart de zéro sans perdre les statistiques, et laisse remonter une panne du serveur', async () => {
    const stats = { runs: 4, bestDepth: 6, bestScore: 2100 }

    // Expédition oubliée par le serveur (404) : pas de reprise.
    const forgotten = createFakeContext({ player: PLAYER, initialSave: { version: 2, runId: ID, guess: '', stats } })
    const gone = stubApi({ getRun: vi.fn().mockRejectedValue(new ApiError(404, 'Expédition inconnue')) })
    const save = await loadExpedition(forgotten.ctx)
    expect(await resumeRun(gone, save)).toBeNull()
    expect(save.stats).toEqual(stats)

    // Sauvegarde d'avant le serveur arbitre : rien n'est demandé au serveur.
    const legacy = createFakeContext({ initialSave: { version: 1, run: { depth: 2, seed: 7 }, stats } })
    const untouched = stubApi()
    expect(await resumeRun(untouched, await loadExpedition(legacy.ctx))).toBeNull()
    expect(untouched.getRun).not.toHaveBeenCalled()

    // Serveur en panne : l'erreur remonte pour que l'écran propose de réessayer.
    const down = stubApi({ getRun: vi.fn().mockRejectedValue(new ApiError(502, 'Serveur indisponible')) })
    await expect(resumeRun(down, save)).rejects.toThrow('Serveur indisponible')
  })
})
