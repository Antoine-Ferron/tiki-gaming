import { create } from 'zustand'
import { newSave, type MiniGtaSave } from '../domain/save'
import { api, type Progress, type PurchaseItem } from '../net/api'
import type { WeaponId, WeaponSlot } from '../systems/weapons'

/**
 * Où va la progression : branchée par l'enveloppe du jeu sur le GameContext de la plateforme
 * (`ctx.save` et `ctx.submitScore`). Sans session (tests), rien n'est persisté.
 */
export interface ProgressSession {
  persist(progress: MiniGtaSave): Promise<void>
}

let session: ProgressSession | null = null

export function bindSession(s: ProgressSession | null) {
  session = s
}

/**
 * Progression du joueur (argent, missions, inventaire). Les transactions sont calculées par le serveur
 * à partir de la progression envoyée ; chaque changement est ensuite sauvegardé via la session.
 */
interface GameState extends MiniGtaSave {
  /** Remplace la progression (chargement de la sauvegarde). */
  load(progress: MiniGtaSave): void
  /** Billets ramassés : comptent dans l'argent et dans le score. */
  addMoney(amount: number): Promise<void>
  /** Mission réussie : le serveur paie la récompense. Renvoie le montant versé. */
  completeMission(id: string): Promise<number>
  purchase(item: PurchaseItem, weapon?: WeaponId): Promise<{ ok: boolean; price: number; rounds: number }>
  respawn(reason: 'dead' | 'busted'): Promise<number>
  save(armor: number, inventory: WeaponSlot[]): Promise<void>
  reset(): Promise<void>
}

export function progressOf(s: MiniGtaSave): Progress {
  return {
    version: s.version,
    money: s.money,
    totalEarned: s.totalEarned,
    armor: s.armor,
    inventory: s.inventory,
    completedMissions: s.completedMissions,
    stats: s.stats,
  }
}

export const useGameStore = create<GameState>()((set, get) => {
  const commit = async (p: Progress) => {
    set(progressOf(p))
    await session?.persist(progressOf(get()))
  }
  return {
    ...newSave(),
    load: (p) => set(progressOf(p)),
    addMoney: async (amount) => {
      const s = get()
      const gain = Math.max(0, Math.round(amount))
      await commit({ ...progressOf(s), money: s.money + gain, totalEarned: s.totalEarned + gain })
    },
    completeMission: async (id) => {
      const r = await api.completeMission(progressOf(get()), id)
      await commit(r.progress)
      return r.reward
    },
    purchase: async (item, weapon) => {
      const r = await api.purchase(progressOf(get()), item, weapon)
      await commit(r.progress)
      return { ok: r.ok, price: r.price, rounds: r.rounds }
    },
    respawn: async (reason) => {
      const r = await api.respawn(progressOf(get()), reason)
      await commit(r.progress)
      return r.fee
    },
    save: async (armor, inventory) => {
      await commit({ ...progressOf(get()), armor: Math.max(0, Math.min(100, Math.round(armor))), inventory })
    },
    reset: async () => {
      await commit(newSave())
    },
  }
})
