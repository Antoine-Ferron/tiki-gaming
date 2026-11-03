import { logger } from '@/lib/logger'
import type { AuditNotifier, Clock, CurrencyConverter, TreasuryRegistry } from './ports'
import type { Player } from './setup'

/** Implémentations de production des contrats de ./ports. */

export const TRADE_PRICE = 2

/** Prix standard du commerce : 2 pièces par ressource. */
export const standardTrade: CurrencyConverter = {
  toCoins: (_resource, quantity) => quantity * TRADE_PRICE,
}

/** Registre adossé aux joueurs de la partie : modifie directement leurs pièces. */
export function playersTreasury(players: Player[]): TreasuryRegistry {
  const find = (name: string) => {
    const player = players.find((p) => p.name === name)
    if (!player) {
      throw new Error(`Joueur inconnu : ${name}`)
    }
    return player
  }
  return {
    balanceOf: (name) => find(name).coins,
    setBalance: (name, coins) => {
      find(name).coins = coins
    },
  }
}

/** Journal d'audit : signalement dans les logs du navigateur, sans appel réseau. */
export const loggerAudit: AuditNotifier = {
  inactivityDetected: (report) => {
    logger.warn({ report }, 'Tour expiré sans carte jouée')
  },
}

export const systemClock: Clock = { now: () => Date.now() }
