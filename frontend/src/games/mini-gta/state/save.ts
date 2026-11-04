import type { Game } from '../game/Game'
import { addWeapon, type Inventory, type WeaponSlot } from '../systems/weapons'
import { useGameStore } from './gameStore'

export function loadInventory(inv: Inventory, saved: WeaponSlot[] | null) {
  if (!saved) return
  inv.weapons = [{ id: 'fists', clip: 0, ammo: 0 }]
  for (const w of saved) {
    if (w.id === 'fists') continue
    addWeapon(inv, w.id, 0)
    const slot = inv.weapons.find((s) => s.id === w.id)!
    slot.clip = w.clip
    slot.ammo = w.ammo
  }
  inv.current = 'fists'
}

/** Sauvegarde la progression (armure et inventaire courants) avec ctx.save. */
export function saveGame(game: Game): Promise<void> {
  const p = game.player
  return useGameStore
    .getState()
    .save(
      Math.round(p.actor.armor),
      p.inventory.weapons.map((w) => ({ ...w })),
    )
    .then(() => game.events.emit('notify', { text: 'Partie sauvegardée', kind: 'success' }))
    .catch((err: Error) => game.events.emit('notify', { text: `Sauvegarde impossible : ${err.message}`, kind: 'fail' }))
}
