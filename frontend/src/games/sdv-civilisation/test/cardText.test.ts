import { describe, expect, it } from 'vitest'
import { fillWithBots } from '../bots'
import { cardStatus, paymentText, stageText, wonderAction } from '../cardText'
import { createGame, wonderPayment } from '../game'
import { fixedRate, identityShuffler } from './fakes'

describe('textes affichés', () => {
  it('annonce une construction gratuite par chaîne', () => {
    const chained = { ok: true, coins: 0, toLeft: 0, toRight: 0, chain: true } as const

    expect(cardStatus(chained).label).toBe('Gratuit par chaîne')
    expect(paymentText(chained, 'IA 2', 'IA 1')).toBe('Gratuit grâce à la chaîne.')
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

    expect(wonderAction(alice, wonderPayment(finished, 0, fixedRate(2)), 'IA 2', 'IA 1')).toEqual({
      title: 'Merveille terminée',
      detail: 'Ta merveille est déjà terminée.',
    })
  })
})
