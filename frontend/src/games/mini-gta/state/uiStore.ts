import { create } from 'zustand'

export type Menu = null | 'pause' | 'map' | 'shop' | 'wheel' | 'help' | 'chat'

export interface Notification {
  id: number
  text: string
  kind: 'info' | 'success' | 'fail' | 'big'
  at: number
}

/** Ligne du chat : message du joueur, réponse d'une commande ou erreur. */
export interface ChatLine {
  id: number
  text: string
  kind: 'self' | 'ok' | 'error'
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
  /** Dernières lignes du chat (affichées quelques secondes, ou toutes quand le chat est ouvert). */
  chat: ChatLine[]
  /** Lignes déjà saisies, rappelées avec les flèches. */
  chatHistory: string[]
  addChat(text: string, kind: ChatLine['kind']): void
  rememberChat(line: string): void
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
  chat: [] as ChatLine[],
})

export const useUiStore = create<UiState>()((set) => ({
  ...initial(),
  exit: null,
  chatHistory: [],
  reset: () => set(initial()),
  addChat: (text, kind) =>
    set((s) => ({ chat: [...s.chat.slice(-19), { id: nextId++, text, kind, at: performance.now() }] })),
  rememberChat: (line) => set((s) => ({ chatHistory: [...s.chatHistory.filter((l) => l !== line), line].slice(-30) })),
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
