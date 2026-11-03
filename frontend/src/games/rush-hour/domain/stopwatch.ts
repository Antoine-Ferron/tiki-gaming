/** Source de temps injectée : l'horloge du navigateur en jeu, une horloge manuelle dans les tests. */
export interface Clock {
  now(): number
}

/** Chrono d'une partie : démarre à sa création, s'arrête à la victoire. */
export class Stopwatch {
  private readonly startedAt: number
  private stoppedAt: number | null = null

  constructor(private readonly clock: Clock) {
    this.startedAt = clock.now()
  }

  get elapsedMs(): number {
    return (this.stoppedAt ?? this.clock.now()) - this.startedAt
  }

  stop(): void {
    this.stoppedAt ??= this.clock.now()
  }
}
