import type { Direction } from './domain/board'

const KEYS: Record<string, Direction> = {
  arrowleft: 'left',
  arrowright: 'right',
  arrowup: 'up',
  arrowdown: 'down',
  z: 'up',
  q: 'left',
  s: 'down',
  d: 'right',
  w: 'up',
  a: 'left',
}

/** Touche du clavier (KeyboardEvent.key) → direction du coup, ou null si la touche ne joue pas (C1). */
export function keyToDirection(key: string): Direction | null {
  return KEYS[key.toLowerCase()] ?? null
}
