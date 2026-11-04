import type { Clock } from '../domain/stopwatch'

/** Doublure d'horloge pour les tests : le temps n'avance que quand le test le décide (pas de Date.now, pas de sleep). */
export class ManualClock implements Clock {
  constructor(private ms = 0) {}
  now() {
    return this.ms
  }
  advance(ms: number) {
    this.ms += ms
  }
}
