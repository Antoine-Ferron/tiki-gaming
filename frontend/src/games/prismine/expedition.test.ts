/**
 * TU — sauvegarde du navigateur (expedition.ts) : identifiant de l'expédition, carte du joueur et
 * statistiques. Les règles de jeu sont testées côté serveur (backend/.../games/prismine).
 */
import { describe, expect, it } from 'vitest'
import { emptyGrid, withPiece } from './engine'
import { emptySave, endStats, guessFor, parseSave, type Save } from './expedition'
import { runView } from './test-doubles'

const ID = '00000000-0000-0000-0000-000000000001'
const STATS = { runs: 2, bestDepth: 4, bestScore: 900 }

describe('sauvegarde', () => {
  it('relit une sauvegarde valide, ignore l’illisible et les anciennes expéditions, et garde le record', () => {
    const valid: Save = { version: 2, runId: ID, guess: withPiece(emptyGrid(6), 0, 'a'), stats: STATS }
    expect(parseSave(JSON.parse(JSON.stringify({ ...valid, extra: true })))).toEqual(valid)
    expect(parseSave({ runId: 3, guess: 'abc/', stats: { runs: -1 } })).toEqual(emptySave())
    // Sauvegarde d'avant le serveur arbitre : l'expédition locale est abandonnée, les statistiques restent.
    expect(parseSave({ version: 1, run: { depth: 3, seed: 7 }, stats: STATS })).toEqual({
      ...emptySave(),
      stats: STATS,
    })

    // Carte reprise seulement si elle a la taille de l'étage.
    expect(guessFor(valid, runView({ size: 7 }))).toBe(emptyGrid(7))
    // Fin d'expédition : seules les statistiques restent, sans faire baisser le record.
    expect(endStats(valid, runView({ depth: 6, score: 300 }))).toEqual({
      ...emptySave(),
      stats: { runs: 3, bestDepth: 6, bestScore: 900 },
    })
  })
})
