import { describe, expect, it } from 'vitest'
import { fillWithBots } from '../bots'
import { cardStatus, duel, paymentText, relevantNeeds, stageText, wonderAction } from '../cardText'
import { createGame, wonderNeeds, wonderPayment } from '../game'
import { fixedRate, identityShuffler } from './fakes'

describe('textes affichés', () => {
  it('annonce une construction gratuite par chaîne', () => {
    const chained = { ok: true, coins: 0, toLeft: 0, toRight: 0, chain: true } as const

    expect(cardStatus(chained).label).toBe('Gratuit par chaîne')
    expect(paymentText(chained, 'IA 2', 'IA 1')).toBe('Gratuit grâce à la chaîne.')
  })

  it('ne met aucune ressource en évidence pour une carte gratuite par chaîne ou déjà construite', () => {
    const needs = [{ resource: 'stone' as const, needed: 1, own: 0, fromLeft: 0, fromRight: 0, missing: 1 }]
    const chained = { ok: true, coins: 0, toLeft: 0, toRight: 0, chain: true } as const
    const built = { ok: false, code: 'built', reason: 'Tu as déjà construit cette carte.' } as const

    expect([relevantNeeds(chained, needs), relevantNeeds(built, needs)]).toEqual([[], []])
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
    // Stub : mélangeur sans effet ; taux figé.
    const game = createGame(fillWithBots(['alice']), identityShuffler)
    const alice = { ...game.players[0], stagesBuilt: 3 }
    const finished = { ...game, players: [alice, ...game.players.slice(1)] }

    expect(wonderNeeds(finished, 0)).toEqual([])
    expect(wonderAction(alice, wonderPayment(finished, 0, fixedRate(2)), 'IA 2', 'IA 1')).toEqual({
      title: 'Merveille terminée',
      detail: 'Ta merveille est déjà terminée.',
    })
  })
})
