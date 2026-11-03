import { apiGet, apiPost } from '@/lib/api'
import type { MiniGtaSave } from '../domain/save'
import type { Step } from '../systems/missions/runner'
import type { WeaponDef, WeaponId } from '../systems/weapons'

/**
 * Client de l'API du jeu (`/api/games/mini-gta`, package backend `fr.tikigaming.games.mini_gta`).
 * Le serveur génère la ville (seed fixe), détient le catalogue des missions et des armes, calcule
 * l'itinéraire GPS et applique les transactions (récompense, achat, frais) à la progression qu'on lui
 * envoie. Il ne stocke rien : la progression est sauvegardée par le jeu avec `ctx.save`.
 */
const BASE = '/games/mini-gta'

export type Progress = MiniGtaSave

export interface MissionDto {
  id: string
  title: string
  brief: string
  reward: number
  giver: { x: number; z: number }
  steps: Step[]
}

/** Monde tel que sérialisé par le backend (voir `cityFromDto`). */
export type WorldDto = Record<string, unknown> & { terrain: { n: number; heights: string } }

export type PurchaseItem = 'weapon' | 'ammo' | 'armor'

export const api = {
  world: () => apiGet<WorldDto>(`${BASE}/world`),
  missions: () => apiGet<MissionDto[]>(`${BASE}/missions`),
  weapons: () => apiGet<Record<WeaponId, WeaponDef>>(`${BASE}/weapons`),
  route: (from: { x: number; z: number }, to: { x: number; z: number }) =>
    apiGet<{ x: number; z: number }[]>(`${BASE}/route?fromX=${from.x}&fromZ=${from.z}&toX=${to.x}&toZ=${to.z}`),
  completeMission: (progress: Progress, id: string) =>
    apiPost<{ rewarded: boolean; reward: number; progress: Progress }>(
      `${BASE}/missions/${encodeURIComponent(id)}/complete`,
      { progress },
    ),
  purchase: (progress: Progress, item: PurchaseItem, weapon?: WeaponId) =>
    apiPost<{ ok: boolean; price: number; rounds: number; progress: Progress }>(`${BASE}/shop/purchase`, {
      progress,
      item,
      weapon,
    }),
  respawn: (progress: Progress, reason: 'dead' | 'busted') =>
    apiPost<{ fee: number; progress: Progress }>(`${BASE}/respawn`, { progress, reason }),
}
