import type { DameView, Move, Names } from './types'

export function startMatch(_names: Names): Promise<DameView> {
  return Promise.reject(new Error('Création à implémenter'))
}

export function readMatch(_id: string): Promise<DameView> {
  return Promise.reject(new Error('Lecture à implémenter'))
}

export function playMove(_id: string, _version: number, _move: Move): Promise<DameView> {
  return Promise.reject(new Error('Coup à implémenter'))
}
