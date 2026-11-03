import type { AuditNotifier, TreasuryRegistry } from './ports'

export const TREASURY_ALERT_THRESHOLD = 30

export interface Treasury {
  balanceOf(player: string): number
  credit(player: string, amount: number): void
  debit(player: string, amount: number): void
  transfer(from: string, to: string, amount: number): void
}

function assertAmount(amount: number): void {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error('Le montant doit être un entier positif')
  }
}

/** Trésor des joueurs, voir docs/games/sdv-civilisation/regles.md#trésor */
export function createTreasury(
  registry: TreasuryRegistry,
  audit: AuditNotifier,
  threshold = TREASURY_ALERT_THRESHOLD,
): Treasury {
  const debit = (player: string, amount: number) => {
    assertAmount(amount)
    const balance = registry.balanceOf(player)
    if (amount > balance) {
      throw new Error('Pas assez de pièces')
    }
    registry.setBalance(player, balance - amount)
  }

  const credit = (player: string, amount: number) => {
    assertAmount(amount)
    const before = registry.balanceOf(player)
    const after = before + amount
    registry.setBalance(player, after)
    if (before < threshold && after >= threshold) {
      audit.treasuryThresholdCrossed({ player, balance: after, threshold })
    }
  }

  return {
    balanceOf: (player) => registry.balanceOf(player),
    credit,
    debit,
    transfer(from, to, amount) {
      debit(from, amount)
      credit(to, amount)
    },
  }
}
