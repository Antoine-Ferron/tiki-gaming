import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { CAMERA_SETTINGS } from '../camera/CameraController'
import { ENV_SETTINGS } from '../render/Environment'
import { PED_SETTINGS } from '../systems/Pedestrians'
import { TRAFFIC_SETTINGS } from '../systems/Traffic'
import { WORLD_SETTINGS } from '../world/WorldRenderer'

export type ShadowQuality = 'off' | 'low' | 'high'

export interface Settings {
  shadows: ShadowQuality
  trafficDensity: number
  pedestrianDensity: number
  viewDistance: number
  sensitivity: number
  invertY: boolean
  postfx: boolean
  resolution: number
}

interface SettingsState extends Settings {
  set(partial: Partial<Settings>): void
}

export const DEFAULT_SETTINGS: Settings = {
  shadows: 'high',
  trafficDensity: 22,
  pedestrianDensity: 30,
  viewDistance: 650,
  sensitivity: 1,
  invertY: false,
  postfx: true,
  resolution: 1,
}

/** Push settings into the engine's module-level tuning objects. */
export function applySettings(s: Settings) {
  ENV_SETTINGS.shadowQuality = s.shadows
  TRAFFIC_SETTINGS.density = s.trafficDensity
  TRAFFIC_SETTINGS.parked = Math.round(s.trafficDensity * 0.6)
  PED_SETTINGS.density = s.pedestrianDensity
  WORLD_SETTINGS.viewDistance = s.viewDistance
  WORLD_SETTINGS.propDistance = Math.min(400, s.viewDistance * 0.5)
  CAMERA_SETTINGS.sensitivity = 0.0022 * s.sensitivity
  CAMERA_SETTINGS.invertY = s.invertY
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      set: (partial) => set(partial),
    }),
    { name: 'mini-gta:settings', version: 2 },
  ),
)
