import { afterEach, beforeAll, describe, expect, test } from 'vitest'
import type { Game } from '../game/Game'
import { newSave } from '../domain/save'
import defs from '../systems/fixtures/weapons.json'
import { createInventory, loadWeaponDefs, type Inventory, type WeaponDef, type WeaponId } from '../systems/weapons'
import { bindSession, useGameStore } from './gameStore'
import { loadInventory, saveGame } from './save'

beforeAll(() => loadWeaponDefs(defs as unknown as Record<WeaponId, WeaponDef>))

afterEach(() => {
  bindSession(null)
  useGameStore.getState().load(newSave())
})

describe('inventaire sauvegardé', () => {
  test('sans inventaire sauvegardé (nouvelle partie), l’inventaire de départ est gardé', () => {
    const inv = createInventory()
    const before = JSON.stringify(inv)

    loadInventory(inv, null)

    expect(JSON.stringify(inv)).toBe(before)
  })

  test('les armes et munitions sauvegardées sont rendues, poings en main', () => {
    const inv = createInventory()

    loadInventory(inv, [
      { id: 'fists', clip: 0, ammo: 0 },
      { id: 'pistol', clip: 7, ammo: 30 },
      { id: 'grenade', clip: 2, ammo: 1 },
    ])

    expect(inv.weapons).toEqual([
      { id: 'fists', clip: 0, ammo: 0 },
      { id: 'pistol', clip: 7, ammo: 30 },
      { id: 'grenade', clip: 2, ammo: 1 },
    ])
    expect(inv.current).toBe('fists')
  })
})

describe('sauvegarde de la partie', () => {
  function fakeGame(inventory: Inventory, armor: number) {
    const notes: { text: string; kind?: string }[] = []
    const game = {
      player: { actor: { armor }, inventory },
      events: { emit: (_: string, n: { text: string; kind?: string }) => notes.push(n) },
    } as unknown as Game
    return { game, notes }
  }

  test('l’armure et l’inventaire courants sont sauvegardés', async () => {
    const saved: unknown[] = []
    bindSession({ persist: async (p) => void saved.push(p) })
    const inv = createInventory()
    loadInventory(inv, [{ id: 'pistol', clip: 3, ammo: 12 }])
    const { game, notes } = fakeGame(inv, 42.6)

    await saveGame(game)

    expect(saved).toEqual([expect.objectContaining({ armor: 43, inventory: inv.weapons })])
    expect(notes).toEqual([{ text: 'Partie sauvegardée', kind: 'success' }])
  })

  test('une sauvegarde impossible est signalée au joueur', async () => {
    bindSession({
      persist: async () => {
        throw new Error('Le serveur est injoignable.')
      },
    })
    const { game, notes } = fakeGame(createInventory(), 0)

    await saveGame(game)

    expect(notes).toEqual([{ text: 'Sauvegarde impossible : Le serveur est injoignable.', kind: 'fail' }])
  })
})
