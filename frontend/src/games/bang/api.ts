import { apiGet, apiPost } from '@/lib/api'
import type { GameView } from './board/view'

export interface TableSeat {
  code: string
  seat: number
  playerCount: number
}

/** Le serveur ignore la casse et les espaces autour du code. */
const table = (code: string) => `/games/bang/tables/${encodeURIComponent(code.trim())}`

export const createTable = () => apiPost<TableSeat>('/games/bang/tables')
export const joinTable = (code: string) => apiPost<TableSeat>(`${table(code)}/join`)
export const startGame = (code: string) => apiPost(`${table(code)}/start`)
export const getView = (code: string) => apiGet<GameView>(`${table(code)}/state`)
export const draw = (code: string) => apiPost(`${table(code)}/turn/draw`)
export const endTurn = (code: string) => apiPost(`${table(code)}/turn/end`)
export const discard = (code: string, cardId: string) =>
  apiPost(`${table(code)}/turn/discard/${encodeURIComponent(cardId)}`)
export const fire = (code: string, cardId: string, targetSeat: number) =>
  apiPost(`${table(code)}/shots/${encodeURIComponent(cardId)}/targets/${targetSeat}`)
export const dodge = (code: string, shotId: string, cardId: string) =>
  apiPost(`${table(code)}/shots/${encodeURIComponent(shotId)}/dodge/${encodeURIComponent(cardId)}`)
