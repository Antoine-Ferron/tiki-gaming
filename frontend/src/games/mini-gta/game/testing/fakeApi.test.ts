import { describe, expect, test } from 'vitest'
import { newSave } from '../../domain/save'
import { api } from './fakeApi'

// Le fake du serveur sert à toutes les simulations : il doit appliquer les mêmes règles d'argent que
// Transactions.java (vérifiées côté serveur par TransactionsTest et les scénarios BDD), sinon les tests de
// simulation valident un comportement que le vrai serveur n'a pas.
describe('fakeApi : mêmes règles d’armurerie que le serveur', () => {
  const rich = { ...newSave(), money: 5000 }

  test.each([
    ['pistol', 300, 24],
    ['shotgun', 1200, 16],
    ['grenade', 400, 5],
  ] as const)(
    'acheter l’arme %s coûte %i $ et donne %i munitions (deux chargeurs, ou un lot si elle se lance)',
    async (weapon, price, rounds) => {
      const r = await api.purchase(rich, 'weapon', weapon)

      expect(r).toMatchObject({ ok: true, price, rounds })
      expect(r.progress.money).toBe(5000 - price)
    },
  )

  test('les munitions se vendent par lot', async () => {
    expect(await api.purchase(rich, 'ammo', 'pistol')).toMatchObject({ ok: true, price: 60, rounds: 36 })
  })

  test('le gilet est débité sans que le serveur ne touche à l’armure (le jeu équipe le personnage)', async () => {
    const r = await api.purchase(rich, 'armor')

    expect(r).toMatchObject({ ok: true, price: 250, rounds: 0 })
    expect(r.progress.armor).toBe(rich.armor)
  })
})

describe('fakeApi : mêmes règles de mission que le serveur', () => {
  test.each([
    [996_999, 999_999],
    [997_000, 1_000_000],
    [997_001, 1_000_000],
    [1_000_000, 1_000_000],
  ])('%i $ déjà gagnés + 3000 $ de mission → score %i $ (plafond de Progress.earn)', async (earned, score) => {
    const r = await api.completeMission({ ...newSave(), totalEarned: earned }, 'special')

    expect(r).toMatchObject({ rewarded: true, reward: 3000 })
    expect(r.progress.money).toBe(3500)
    expect(r.progress.totalEarned).toBe(score)
  })
})
