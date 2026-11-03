import { CARDS_BY_AGE, type Card } from '../cards'
import type { Clock, CurrencyConverter, Shuffler, TreasuryRegistry } from '../ports'

/** Carte du catalogue par son nom, pour préparer un scénario. */
export function findCard(name: string): Card {
  return Object.values(CARDS_BY_AGE)
    .flat()
    .find((c) => c.name === name)!
}

/** Stub : ne mélange rien, les cartes restent dans l'ordre du catalogue. */
export const identityShuffler: Shuffler = { shuffle: (items) => [...items] }

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
