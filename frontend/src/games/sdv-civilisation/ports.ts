/**
 * Contrats du jeu : interfaces pures, sans I/O, dont dépend la logique.
 * Implémentations de production dans ./adapters, doublures de test dans ./testing/fakes.
 */

export type Resource = 'wood' | 'stone' | 'clay' | 'ore' | 'glass' | 'papyrus' | 'textile'

/** Prix d'achat de ressources à un voisin, en pièces. */
export interface CurrencyConverter {
  toCoins(resource: Resource, quantity: number): number
}

/** Registre des pièces de chaque joueur. */
export interface TreasuryRegistry {
  balanceOf(player: string): number
  setBalance(player: string, coins: number): void
}

export interface TreasuryAlert {
  player: string
  balance: number
  threshold: number
}

/** Journal d'audit anti-triche. */
export interface AuditNotifier {
  treasuryThresholdCrossed(alert: TreasuryAlert): void
}

/** Heure courante, en millisecondes : remplace `Date.now()` / `new Date()` dans la logique du jeu. */
export interface Clock {
  now(): number
}
