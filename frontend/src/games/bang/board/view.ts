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

export interface GameView {
  code: string
  seat: number
  currentSeat: number
  /** Mon rôle, privé. */
  role: string
  hand: ViewCard[]
  players: ViewPlayer[]
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
