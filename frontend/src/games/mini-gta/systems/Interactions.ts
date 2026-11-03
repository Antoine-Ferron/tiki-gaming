import { input } from '../core/input'
import { saveGame } from '../state/save'
import { useUiStore } from '../state/uiStore'
import type { Game } from '../game/Game'

/** Context prompts and the "E" / "F" interactions. */
export class Interactions {
  prompt: string | null = null

  constructor(private game: Game) {}

  update() {
    const game = this.game
    const p = game.player
    this.prompt = null
    if (!p.alive || game.ui.blocking) return
    const pos = p.position
    const L = game.city.locations
    const E = input.label('KeyE')
    const F = input.label('KeyF')
    if (p.state === 'vehicle') {
      const v = p.vehicle!
      if (v.isAircraft)
        this.prompt =
          v.spec.kind === 'heli'
            ? `${input.label('ShiftLeft')} monter · Ctrl descendre · ${input.label('KeyW')}/${input.label('KeyS')} tangage · ${input.label('KeyA')}/${input.label('KeyD')} lacet`
            : `${input.label('ShiftLeft')}/Ctrl gaz · ${input.label('KeyW')}/${input.label('KeyS')} tangage · ${input.label('KeyA')}/${input.label('KeyD')} roulis`
      return
    }
    const near = (l: { x: number; z: number }, r: number) => Math.hypot(pos.x - l.x, pos.z - l.z) < r
    const giver = game.missions.giverNear(pos)
    if (giver) {
      this.prompt = `${E} : démarrer « ${giver.title} »`
      if (input.wasPressed('KeyE')) game.missions.start(giver)
      return
    }
    if (near(L.gunshopCounter, 4)) {
      this.prompt = `${E} : armurerie`
      if (input.wasPressed('KeyE')) useUiStore.getState().setMenu('shop')
      return
    }
    if (near(L.safehouseInside, 4.5)) {
      this.prompt = `${E} : sauvegarder la partie`
      if (input.wasPressed('KeyE')) void saveGame(game) // saveGame signale lui-même ses erreurs
      return
    }
    const v = p.nearbyVehicle()
    if (v) this.prompt = `${F} : ${v.driver ? 'voler' : 'entrer dans'} ${v.spec.label.toLowerCase()}`
  }
}
