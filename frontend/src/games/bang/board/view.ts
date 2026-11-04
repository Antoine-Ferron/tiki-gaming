/** La vue d'un joueur, telle que le serveur l'envoie (`GET /api/games/bang/tables/{code}/state`). */
export interface ViewCard {
  id: string
  type: string
}

export interface ViewPlayer {
  seat: number
  character: string
  health: number
  maxHealth: number
  playedCards: ViewCard[]
  handCount: number
  /** Présent seulement pour le Shérif, dont le rôle est public. */
  role?: string
}

export type Phase = 'DRAW' | 'PLAY' | 'DISCARD'

export interface GameView {
  code: string
  seat: number
  currentSeat: number
  /** Phase du joueur actif. */
  phase: Phase
  /** Mon rôle, privé. */
  role: string
  hand: ViewCard[]
  players: ViewPlayer[]
}

/** On ne choisit un BANG ! que pendant sa propre phase de jeu. */
export function canShoot(view: GameView): boolean {
  return view.currentSeat === view.seat && view.phase === 'PLAY'
}

/** Ce que je dois faire maintenant, ou à qui c'est de jouer. */
export function turnHint(view: GameView): string {
  if (view.currentSeat !== view.seat) return `Au tour de la place ${view.currentSeat}.`
  const health = view.players.find((p) => p.seat === view.seat)?.health ?? 0
  if (view.phase === 'DRAW') return 'À toi de jouer : pioche tes deux cartes.'
  if (view.phase === 'PLAY') return 'À toi de jouer : choisis un BANG ! et ta cible, ou termine ton tour.'
  if (view.hand.length > health) return `Tu as trop de cartes : défausse-en jusqu'à ${health}.`
  return 'Tu as défaussé assez de cartes : finis ton tour.'
}

export type Position = 'bottom' | 'left' | 'top' | 'right'

const POSITIONS: Position[] = ['bottom', 'left', 'top', 'right']

/** Où s'affiche une place autour du plateau, vue depuis ma place (sens horaire : bas, gauche, haut, droite). */
export function positionOf(seat: number, mySeat: number): Position {
  return POSITIONS[(seat - mySeat + POSITIONS.length) % POSITIONS.length]
}

/** Nom serveur (« BART_CASSIDY ») vers nom de front et de fichier (« bart-cassidy »). */
export function slug<T extends string>(serverName: string): T {
  return serverName.toLowerCase().replace(/_/g, '-') as T
}

const CARD_LABELS: Record<string, string> = { BANG: 'BANG !', MISSED: 'Raté !', HIDEOUT: 'Planque' }

export function cardLabel(type: string): string {
  return CARD_LABELS[type] ?? type
}
