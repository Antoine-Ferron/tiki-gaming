import { describe, expect, it } from 'vitest'
import { cardStatus, duel, paymentText, stageText, wonderAction } from '../cardText'
import { contract } from './fakes'

describe('textes affichés', () => {
  it('annonce une construction gratuite par chaîne', () => {
    const chained = { ok: true, coins: 0, toLeft: 0, toRight: 0, chain: true } as const

    expect(cardStatus(chained).label).toBe('Gratuit par chaîne')
    expect(paymentText(chained, 'IA 2', 'IA 1')).toBe('Gratuit grâce à la chaîne.')
  })

  it('compare les boucliers voisin par voisin', () => {
    expect([duel(3, 2), duel(3, 4), duel(2, 2)].map((d) => d.label)).toEqual(['Victoire', 'Défaite', 'Égalité'])
  })

  it('décrit chaque effet d’étape de merveille', () => {
    expect([{ points: 3 }, { shields: 2 }, { coins: 6 }].map((effect) => stageText({ cost: {}, ...effect }))).toEqual([
      '3 points',
      '2 boucliers',
      '+6 pièces',
    ])
  })

  it('signale une merveille terminée', () => {
    // Étant donné alice dont les 3 étapes sont bâties (le serveur refuse alors toute étape)
    const alice = { ...contract.start.players[0], stagesBuilt: 3 }
    const refused = { ok: false, code: 'wonder', reason: 'Ta merveille est déjà terminée.' } as const

    expect(wonderAction(alice, refused, 'IA 2', 'IA 1')).toEqual({
      title: 'Merveille terminée',
      detail: 'Ta merveille est déjà terminée.',
    })
  })
})
