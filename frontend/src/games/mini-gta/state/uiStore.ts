import { create } from 'zustand'

export type Menu = null | 'pause' | 'map' | 'shop' | 'wheel' | 'help'

export interface Notification {
  id: number
  text: string
  kind: 'info' | 'success' | 'fail' | 'big'
  at: number
}

interface UiState {
  menu: Menu
  started: boolean
  loading: { text: string; progress: number } | null
  notifications: Notification[]
  waypoint: { x: number; z: number } | null
  /** Échec du chargement (serveur injoignable…), affiché sur l'écran de démarrage. */
  loadError: string | null
  /** Quitte la partie et revient à l'écran d'accueil du jeu (branché par l'enveloppe). */
  exit: (() => void) | null
  setMenu(menu: Menu): void
  notify(text: string, kind?: Notification['kind']): void
  prune(now: number): void
  /** Remet l'interface à zéro au lancement d'une partie. */
  reset(): void
}

let nextId = 1

const initial = () => ({
  menu: null as Menu,
  started: false,
  loading: { text: 'Chargement…', progress: 0 },
  notifications: [] as Notification[],
  waypoint: null,
  loadError: null,
})

export const useUiStore = create<UiState>()((set) => ({
  ...initial(),
  exit: null,
  reset: () => set(initial()),
  setMenu: (menu) => set({ menu }),
  notify: (text, kind = 'info') =>
    set((s) => ({
      notifications: [...s.notifications.slice(-5), { id: nextId++, text, kind, at: performance.now() }],
    })),
  prune: (now) =>
    set((s) => {
      const keep = s.notifications.filter(
        (n) => now - n.at < (n.kind === 'big' ? 3500 : n.kind === 'info' ? 6000 : 4500),
      )
      return keep.length === s.notifications.length ? s : { notifications: keep }
    }),
}))
