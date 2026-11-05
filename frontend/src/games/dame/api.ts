import { apiGet, apiPost } from '@/lib/api'
import type { DameView, Move, Names } from './types'

const ROOT = '/games/dame/matches'

export function startMatch(names: Names): Promise<DameView> {
  return apiPost<DameView>(ROOT, names)
}

export function readMatch(id: string): Promise<DameView> {
  return apiGet<DameView>(`${ROOT}/${encodeURIComponent(id)}`)
}

export function playMove(id: string, version: number, move: Move): Promise<DameView> {
  return apiPost<DameView>(`${ROOT}/${encodeURIComponent(id)}/moves`, { version, ...move })
}
