import type { Clock, CurrencyConverter, TreasuryRegistry } from '../ports'

/** Stub : convertit toujours au même taux, quel que soit le prix réel du commerce. */
export function fixedRate(coinsPerResource: number): CurrencyConverter {
  return { toCoins: (_resource, quantity) => quantity * coinsPerResource }
}

/** Fake : registre du trésor en mémoire, initialisé avec les soldes donnés. */
export class FakeTreasuryRegistry implements TreasuryRegistry {
  private readonly balances: Map<string, number>

  constructor(initial: Record<string, number> = {}) {
    this.balances = new Map(Object.entries(initial))
  }

  balanceOf(player: string): number {
    return this.balances.get(player) ?? 0
  }

  setBalance(player: string, coins: number): void {
    this.balances.set(player, coins)
  }
}

/** Fake : horloge qui n'avance que quand le test le demande (pas d'attente réelle). */
export class FakeClock implements Clock {
  private current: number

  constructor(start = 0) {
    this.current = start
  }

  now(): number {
    return this.current
  }

  advance(ms: number): void {
    this.current += ms
  }
}
