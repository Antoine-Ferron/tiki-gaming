import { describe, expect, test } from 'vitest'
import { MAX_SCORE, newSave, saveSchema, scoreToSubmit, type MiniGtaSave } from './save'

const valid: MiniGtaSave = {
  version: 1,
  money: 1200,
  totalEarned: 3400,
  armor: 50,
  inventory: [{ id: 'pistol', clip: 12, ammo: 48 }],
  completedMissions: ['express'],
  stats: { kills: 3, wantedMax: 2, playTime: 125.5 },
}

describe('saveSchema', () => {
  test('accepte une sauvegarde complète', () => {
    // Act
    const result = saveSchema.safeParse(valid)

    // Assert
    expect(result.success).toBe(true)
  })

  test('accepte un inventaire absent (nouvelle partie)', () => {
    expect(saveSchema.safeParse({ ...valid, inventory: null }).success).toBe(true)
  })

  test.each([
    ['ancienne version', { ...valid, version: 0 }],
    ['argent négatif', { ...valid, money: -1 }],
    ['argent non entier', { ...valid, money: 1.5 }],
    ['gains cumulés négatifs', { ...valid, totalEarned: -1 }],
    ['armure au-delà de 100', { ...valid, armor: 101 }],
    ['arme inconnue', { ...valid, inventory: [{ id: 'laser', clip: 1, ammo: 1 }] }],
    ['munitions négatives', { ...valid, inventory: [{ id: 'pistol', clip: -1, ammo: 0 }] }],
    ['stats absentes', { ...valid, stats: undefined }],
    ['pas un objet', 'corrompu'],
  ])('refuse : %s', (_, data) => {
    expect(saveSchema.safeParse(data).success).toBe(false)
  })
})

describe('newSave', () => {
  test('nouvelle partie : 500 $, rien de gagné, aucune mission', () => {
    expect(newSave()).toEqual({
      version: 1,
      money: 500,
      totalEarned: 0,
      armor: 0,
      inventory: null,
      completedMissions: [],
      stats: { kills: 0, wantedMax: 0, playTime: 0 },
    })
  })

  test('respecte son propre schéma', () => {
    expect(saveSchema.safeParse(newSave()).success).toBe(true)
  })
})

describe('scoreToSubmit', () => {
  test.each([
    ['premier score', 100, null, 100],
    ['record battu', 300, 200, 300],
    ['égal au record : rien à envoyer', 200, 200, null],
    ['sous le record : rien à envoyer', 100, 200, null],
    ['rien gagné : rien à envoyer', 0, null, null],
    ['au plafond', MAX_SCORE, null, MAX_SCORE],
    ['au-delà du plafond : ramené au plafond', MAX_SCORE + 1, null, MAX_SCORE],
    ['plafond déjà envoyé', MAX_SCORE + 1, MAX_SCORE, null],
  ])('%s', (_, totalEarned, lastSent, expected) => {
    expect(scoreToSubmit(totalEarned, lastSent)).toBe(expected)
  })
})
