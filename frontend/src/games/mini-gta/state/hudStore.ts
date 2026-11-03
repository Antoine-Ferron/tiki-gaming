import { create } from 'zustand'
import type { Game } from '../game/Game'
import { WEAPONS, type WeaponId } from '../systems/weapons'

export interface HudState {
  ready: boolean
  health: number
  maxHealth: number
  armor: number
  wanted: number
  wantedFlashing: boolean
  weapon: WeaponId
  weaponLabel: string
  clip: number
  ammo: number
  reloading: boolean
  aiming: boolean
  inVehicle: boolean
  vehicleLabel: string
  speedKmh: number
  altitude: number
  vehicleHealth: number
  mission: { title: string; objective: string; timer: number | null } | null
  prompt: string | null
  state: string
  hours: number
  weather: string
  owned: WeaponId[]
}

export const useHudStore = create<HudState>()(() => ({
  ready: false,
  health: 100,
  maxHealth: 100,
  armor: 0,
  wanted: 0,
  wantedFlashing: false,
  weapon: 'fists',
  weaponLabel: 'Poings',
  clip: 0,
  ammo: 0,
  reloading: false,
  aiming: false,
  inVehicle: false,
  vehicleLabel: '',
  speedKmh: 0,
  altitude: 0,
  vehicleHealth: 1,
  mission: null,
  prompt: null,
  state: 'foot',
  hours: 12,
  weather: 'clear',
  owned: ['fists'],
}))

/** Push a snapshot of the game state to the HUD (called ~15 Hz). */
export function publishHud(game: Game) {
  const p = game.player
  const a = p.actor
  const inv = p.inventory
  const slot = inv.weapons.find((w) => w.id === inv.current)
  const v = p.vehicle
  useHudStore.setState({
    ready: true,
    health: a.health,
    maxHealth: a.maxHealth,
    armor: a.armor,
    wanted: game.police.wanted.stars,
    wantedFlashing: game.police.wanted.searching,
    weapon: inv.current,
    weaponLabel: WEAPONS[inv.current].label,
    clip: slot?.clip ?? 0,
    ammo: slot?.ammo ?? 0,
    reloading: game.combat.isReloading,
    aiming: p.aiming,
    inVehicle: !!v,
    vehicleLabel: v?.spec.label ?? '',
    speedKmh: v ? Math.round(Math.abs(v.speed) * 3.6) : 0,
    altitude: v ? Math.round(v.position.y) : 0,
    vehicleHealth: v ? Math.max(0, v.health / v.spec.health) : 1,
    mission: game.missions.hud(),
    prompt: game.interactions.prompt,
    state: p.state,
    hours: game.env.hours,
    weather: game.env.weather,
    owned: inv.weapons.map((w) => w.id),
  })
}
