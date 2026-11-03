/**
 * Contrats du jeu côté front : interfaces pures, sans I/O, dont dépend la logique d'affichage.
 * Implémentations de production dans ./adapters, doublures de test dans ./test/fakes.
 * Le serveur fait autorité (trésor, commerce, temps de tour) : le front ne fait que prévisualiser.
 */

export type Resource = 'wood' | 'stone' | 'clay' | 'ore' | 'glass' | 'papyrus' | 'textile'

/** Prix d'achat de ressources à un voisin, en pièces. */
export interface CurrencyConverter {
  toCoins(resource: Resource, quantity: number): number
}

/** Pièces des joueurs de la table, telles que connues par le client. */
export interface TreasuryRegistry {
  balanceOf(player: string): number
  setBalance(player: string, coins: number): void
}

export interface InactivityReport {
  player: string
  deadline: number
}

/** Journal d'audit : signale un joueur qui laisse expirer son tour. */
export interface AuditNotifier {
  inactivityDetected(report: InactivityReport): void
}

/** Heure courante, en millisecondes : remplace `Date.now()` / `new Date()` dans la logique du jeu. */
export interface Clock {
  now(): number
}
