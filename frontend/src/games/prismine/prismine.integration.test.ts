/**
 * Tests d'intégration : des expéditions complètes, de bout en bout, sans interface.
 * Les vrais modules du jeu travaillent ensemble (engine → expedition → session) et parlent à un faux
 * GameContext (test-doubles.ts) qui garde la sauvegarde en mémoire, en JSON, comme Supabase ou le
 * localStorage. On vérifie ce que la plateforme reçoit : sauvegardes, reprise après rechargement, score.
 * Les graines sont fixes : chaque test rejoue exactement la même partie.
 */
import { describe, expect, it, vi } from 'vitest'
import { entryCount, generateFloor, type Floor } from './engine'
import {
  ERROR_COST,
  FLOOR_REFILL,
  START_OIL,
  endRun,
  fire,
  floorPoints,
  knownEntries,
  newRun,
  probeResults,
  validate,
  type Run,
} from './expedition'
import { createSaver, loadExpedition, submitRunScore } from './session'
import { createFakeContext } from './test-doubles'

const PLAYER = { id: 'joueur-1', username: 'clement' }

/** Joueur « méthodique » : tire depuis chaque entrée encore inconnue de l'étage. */
function sweep(run: Run, floor: Floor): Run {
  for (let entry = 0; entry < entryCount(floor.size); entry++) {
    if (!knownEntries(probeResults(floor, run.probes)).has(entry)) run = fire(run, entry)
  }
  return run
}

/** Valide une carte et exige le verdict attendu (le test échoue avec un message clair sinon). */
function expectVerdict<K extends ReturnType<typeof validate>['kind']>(
  verdict: ReturnType<typeof validate>,
  kind: K,
): Extract<ReturnType<typeof validate>, { kind: K }> {
  expect(verdict.kind).toBe(kind)
  return verdict as Extract<ReturnType<typeof validate>, { kind: K }>
}

describe('expédition d’un joueur connecté', () => {
  it('sauvegarde chaque étape, reprend après rechargement et classe le score final', async () => {
    const { ctx, ranked, stored } = createFakeContext({ player: PLAYER })
    const onSaveError = vi.fn()
    const persist = createSaver(ctx, onSaveError)

    // Ouverture du jeu : aucune sauvegarde, on démarre une expédition.
    let save = await loadExpedition(ctx)
    expect(save.run).toBeNull()
    save = { ...save, run: newRun(42) }
    await persist(save)

    // Étage 1 : balayage complet puis carte juste, sans erreur.
    const floor1 = generateFloor(1, 42)
    const run = sweep(save.run!, floor1)
    const probes1 = run.probes.length
    expect(run.oil).toBe(START_OIL - probes1)
    const cleared1 = expectVerdict(validate({ ...run, guess: floor1.grid }, floor1, 7), 'cleared')
    save = { ...save, run: cleared1.next }
    await persist(save)

    // Rechargement de la page : la plateforme rend exactement l'expédition sauvegardée, sur l'étage 2.
    const reloaded = await loadExpedition(ctx)
    expect(reloaded).toEqual(save)
    expect(reloaded.run).toMatchObject({ depth: 2, score: 150, oil: START_OIL - probes1 + FLOOR_REFILL })

    // Étage 2 : une validation ratée (carte vide), puis la bonne carte.
    const floor2 = generateFloor(2, reloaded.run!.seed)
    const wrong = expectVerdict(
      validate(reloaded.run!, floor2, 8, () => 0),
      'wrong',
    )
    expect(wrong.next.oil).toBe(reloaded.run!.oil - ERROR_COST)
    const cleared2 = expectVerdict(validate({ ...wrong.next, guess: floor2.grid }, floor2, 9), 'cleared')
    expect(cleared2.perfect).toBe(false)

    // Le joueur termine l'expédition à l'étage 3 : statistiques sauvegardées, score classé.
    const ended = cleared2.next
    save = endRun(save, ended)
    await persist(save)
    expect(await submitRunScore(ctx, ended)).toBe(true)

    const expectedScore = floorPoints(1, true) + floorPoints(2, false)
    // Le tir révélé après l'erreur est offert : seuls les tirs payés en huile sont comptés.
    const metadata = { depth: 3, probes: probes1, errors: 1 }
    expect(ctx.submitScore).toHaveBeenCalledExactlyOnceWith(expectedScore, metadata)
    expect(ranked).toEqual([{ score: expectedScore, metadata }])
    expect(stored()).toEqual({ version: 1, run: null, stats: { runs: 1, bestDepth: 3, bestScore: expectedScore } })
    expect(onSaveError).not.toHaveBeenCalled()
  })
})

describe('expédition d’un invité', () => {
  it('garde la progression localement mais ne classe pas le score', async () => {
    const { ctx, ranked, stored } = createFakeContext({ player: null })
    const persist = createSaver(ctx, vi.fn())

    let save = await loadExpedition(ctx)
    const floor = generateFloor(1, 3)
    const cleared = expectVerdict(validate({ ...newRun(3), guess: floor.grid }, floor, 4), 'cleared')
    save = endRun(save, cleared.next)
    await persist(save)

    expect(await submitRunScore(ctx, cleared.next)).toBe(false)
    expect(ctx.submitScore).toHaveBeenCalledOnce()
    expect(ranked).toEqual([])
    expect(stored()).toMatchObject({ stats: { runs: 1, bestScore: 150 } })
  })
})

describe('reprise d’une expédition presque perdue', () => {
  it("éteint la lampe sur une erreur impayable et n'envoie aucun score sans étage réussi", async () => {
    // Bouchon de départ : une expédition déjà sauvegardée, avec seulement 2 doses d'huile.
    const seed = 11
    const { ctx, stored } = createFakeContext({
      player: PLAYER,
      initialSave: {
        version: 1,
        run: { ...newRun(seed), oil: ERROR_COST - 1 },
        stats: { runs: 4, bestDepth: 6, bestScore: 2100 },
      },
    })

    const save = await loadExpedition(ctx)
    expect(save.run?.oil).toBe(ERROR_COST - 1)
    const floor = generateFloor(1, seed)
    const lampOut = expectVerdict(validate(save.run!, floor, 1), 'lamp-out')

    await createSaver(ctx, vi.fn())(endRun(save, lampOut.run))
    expect(await submitRunScore(ctx, lampOut.run)).toBe(false)
    expect(ctx.submitScore).not.toHaveBeenCalled()
    // Le record précédent est conservé, l'expédition est comptée.
    expect(stored()).toEqual({ version: 1, run: null, stats: { runs: 5, bestDepth: 6, bestScore: 2100 } })
  })
})
