import { describe, expect, it, vi } from 'vitest'
import type { AuditNotifier } from '../ports'
import { FakeTreasuryRegistry } from './fakes'
import { createTreasury, TREASURY_ALERT_THRESHOLD } from '../treasury'

/** Mock : enregistre les appels à la passerelle d'audit, sans journal réel. */
function mockAudit() {
  return { treasuryThresholdCrossed: vi.fn<AuditNotifier['treasuryThresholdCrossed']>() }
}

function setup(balances: Record<string, number>) {
  const registry = new FakeTreasuryRegistry(balances)
  const audit = mockAudit()
  return { registry, audit, treasury: createTreasury(registry, audit) }
}

describe('createTreasury', () => {
  it('crédite le joueur', () => {
    const { registry, treasury } = setup({ alice: 1 })

    treasury.credit('alice', 3)

    expect(registry.balanceOf('alice')).toBe(4)
  })

  it.each([
    { balance: 5, amount: 5, expected: 0 },
    { balance: 5, amount: 2, expected: 3 },
  ])('débite $amount pièces sur $balance', ({ balance, amount, expected }) => {
    const { registry, treasury } = setup({ alice: balance })

    treasury.debit('alice', amount)

    expect(registry.balanceOf('alice')).toBe(expected)
  })

  it('refuse un débit supérieur au trésor sans rien débiter', () => {
    const { registry, treasury } = setup({ alice: 5 })

    expect(() => treasury.debit('alice', 6)).toThrow('Pas assez de pièces')
    expect(registry.balanceOf('alice')).toBe(5)
  })

  it.each([0, -1, 1.5])('refuse un montant de %s pièces', (amount) => {
    const { treasury } = setup({ alice: 5 })

    expect(() => treasury.credit('alice', amount)).toThrow('Le montant doit être un entier positif')
    expect(() => treasury.debit('alice', amount)).toThrow('Le montant doit être un entier positif')
  })

  it('transfère les pièces d’un joueur à un autre', () => {
    const { registry, treasury } = setup({ alice: 5, bob: 1 })

    treasury.transfer('alice', 'bob', 4)

    expect(registry.balanceOf('alice')).toBe(1)
    expect(registry.balanceOf('bob')).toBe(5)
  })

  it('refuse un transfert impayable sans créditer le destinataire', () => {
    const { registry, treasury } = setup({ alice: 1, bob: 1 })

    expect(() => treasury.transfer('alice', 'bob', 2)).toThrow('Pas assez de pièces')
    expect(registry.balanceOf('bob')).toBe(1)
  })
})

describe('audit du seuil critique', () => {
  it('fixe le seuil critique à 30 pièces', () => {
    expect(TREASURY_ALERT_THRESHOLD).toBe(30)
  })

  it('signale une seule fois le joueur qui franchit le seuil', () => {
    const { audit, treasury } = setup({ alice: 29 })

    treasury.credit('alice', 1)

    expect(audit.treasuryThresholdCrossed).toHaveBeenCalledTimes(1)
    expect(audit.treasuryThresholdCrossed).toHaveBeenCalledWith({ player: 'alice', balance: 30, threshold: 30 })
  })

  it.each([
    { from: 28, amount: 1, crossed: false },
    { from: 29, amount: 1, crossed: true },
    { from: 10, amount: 25, crossed: true },
    { from: 30, amount: 1, crossed: false },
  ])('de $from à $from + $amount : signalé = $crossed', ({ from, amount, crossed }) => {
    const { audit, treasury } = setup({ alice: from })

    treasury.credit('alice', amount)

    expect(audit.treasuryThresholdCrossed).toHaveBeenCalledTimes(crossed ? 1 : 0)
  })

  it('ne signale pas à nouveau un joueur qui reste au-dessus du seuil', () => {
    const { audit, treasury } = setup({ alice: 29 })

    treasury.credit('alice', 1)
    treasury.credit('alice', 3)
    treasury.debit('alice', 2)

    expect(audit.treasuryThresholdCrossed).toHaveBeenCalledTimes(1)
  })

  it('signale de nouveau après être repassé sous le seuil', () => {
    const { audit, treasury } = setup({ alice: 29 })

    treasury.credit('alice', 1)
    treasury.debit('alice', 5)
    treasury.credit('alice', 5)

    expect(audit.treasuryThresholdCrossed).toHaveBeenCalledTimes(2)
  })

  it('signale le destinataire d’un transfert qui franchit le seuil', () => {
    const { audit, treasury } = setup({ alice: 40, bob: 28 })

    treasury.transfer('alice', 'bob', 2)

    expect(audit.treasuryThresholdCrossed).toHaveBeenCalledExactlyOnceWith({
      player: 'bob',
      balance: 30,
      threshold: 30,
    })
  })
})
