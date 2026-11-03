import { TERRAIN_CELLS } from '../../world/constants'
import type { MissionDto, Progress, PurchaseItem, WorldDto } from '../../net/api'
import type { WeaponDef, WeaponId } from '../../systems/weapons'
import missions from '../fixtures/missions.json'
import worldAroundSpawn from '../fixtures/world-spawn.json'
import weapons from '../../systems/fixtures/weapons.json'

/**
 * Doublure de `net/api` pour les tests : une portion de la vraie ville (terrain plat) et les règles d'argent du
 * backend (récompense unique, achat refusé sans les fonds, frais de réapparition). À brancher avec
 * `vi.mock('…/net/api', () => import('…/game/testing/fakeApi'))`.
 */

function flatTerrain(): string {
  const bytes = new Uint8Array((TERRAIN_CELLS + 1) ** 2 * 4)
  let bin = ''
  for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode(...bytes.subarray(i, i + 8192))
  return btoa(bin)
}

const defs = weapons as unknown as Record<WeaponId, WeaponDef & { price: number; ammoPrice: number; ammoPack: number }>
const catalog = missions as unknown as MissionDto[]

const gain = (p: Progress, n: number): Progress => ({ ...p, money: p.money + n, totalEarned: p.totalEarned + n })
const spend = (p: Progress, n: number): Progress => ({ ...p, money: Math.max(0, p.money - n) })

/** Appels reçus, pour vérifier ce que le jeu demande au serveur. */
export const calls: { name: string; args: unknown[] }[] = []

/** Panne simulée : le prochain appel rejette avec cette erreur. */
export let nextFailure: Error | null = null
export function failNext(error: Error) {
  nextFailure = error
}

async function serve<T>(name: string, args: unknown[], answer: () => T): Promise<T> {
  calls.push({ name, args })
  if (nextFailure) {
    const e = nextFailure
    nextFailure = null
    throw e
  }
  return answer()
}

export const api = {
  world: () =>
    serve(
      'world',
      [],
      () => ({ ...worldAroundSpawn, terrain: { n: TERRAIN_CELLS, heights: flatTerrain() } }) as WorldDto,
    ),
  missions: () => serve('missions', [], () => catalog),
  weapons: () => serve('weapons', [], () => defs),
  route: (from: { x: number; z: number }, to: { x: number; z: number }) => serve('route', [from, to], () => [from, to]),
  completeMission: (progress: Progress, id: string) =>
    serve('completeMission', [progress, id], () => {
      const m = catalog.find((x) => x.id === id)
      if (!m) throw new Error('Mission inconnue.')
      if (progress.completedMissions.includes(id)) return { rewarded: false, reward: 0, progress }
      const next = gain(progress, m.reward)
      return {
        rewarded: true,
        reward: m.reward,
        progress: { ...next, completedMissions: [...progress.completedMissions, id] },
      }
    }),
  purchase: (progress: Progress, item: PurchaseItem, weapon?: WeaponId) =>
    serve('purchase', [progress, item, weapon], () => {
      const d = weapon ? defs[weapon] : undefined
      const price = item === 'armor' ? 250 : item === 'weapon' ? d!.price : d!.ammoPrice
      const rounds = item === 'armor' ? 0 : item === 'weapon' ? d!.ammoPack : d!.ammoPack
      if (progress.money < price) return { ok: false, price, rounds: 0, progress }
      const next = spend(progress, price)
      return { ok: true, price, rounds, progress: item === 'armor' ? { ...next, armor: 100 } : next }
    }),
  respawn: (progress: Progress, reason: 'dead' | 'busted') =>
    serve('respawn', [progress, reason], () => {
      const fee =
        reason === 'dead'
          ? Math.max(100, Math.round(progress.money * 0.1))
          : Math.max(200, Math.round(progress.money * 0.15))
      return { fee, progress: spend(progress, fee) }
    }),
}
