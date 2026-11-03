import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber'
import { expect, vi } from 'vitest'
import { chooseAction } from '../ai'
import { fillWithBots } from '../bots'
import { createGame, playTurn, type Action, type GameState } from '../game'
import type { CurrencyConverter } from '../ports'
import { finalScore, ranking } from '../score'
import { findCard, fixedRate, identityShuffler } from './fakes'

const feature = await loadFeature('src/games/sdv-civilisation/test/partie.feature', { language: 'fr' })

// Les étapes appellent le moteur de partie, jamais l'écran.
describeFeature(feature, ({ Background, Scenario, ScenarioOutline }) => {
  let state: GameState
  let before: GameState
  let converter: CurrencyConverter
  let refusal: string | null
  let priceRequests: unknown[][]

  const seat = (name: string) => state.players.findIndex((p) => p.name === name)
  const player = (name: string) => state.players[seat(name)]
  const handNames = (game: GameState, index: number) => game.hands[index].map((c) => c.name)

  function play(actions: Action[]) {
    before = state
    state = playTurn(state, actions, converter, identityShuffler)
  }

  // Seul le joueur du scénario agit vraiment : les autres construisent la Verrerie, gratuite et sans effet sur les pièces.
  function act(name: string, action: Action) {
    play(state.players.map((_, i) => (i === seat(name) ? action : { type: 'build', card: 'Verrerie' })))
  }

  function attempt(name: string, action: Action) {
    try {
      act(name, action)
    } catch (err) {
      refusal = (err as Error).message
    }
  }

  Background(({ Given }) => {
    Given('une partie entre "alice", "IA 1" et "IA 2"', () => {
      converter = fixedRate(2) // Stub : taux de change figé à 2 pièces par ressource
      refusal = null
      // Stub : le mélangeur garde l'ordre. Chaque main contient les 7 cartes de l'âge dans l'ordre du catalogue,
      // et les merveilles sont attribuées dans l'ordre : alice minerai, IA 1 verre, IA 2 bois.
      state = createGame(fillWithBots(['alice']), identityShuffler)
    })
  })

  Scenario('Chaque joueur commence avec 3 pièces et sa propre merveille', ({ Then, And }) => {
    Then('chaque joueur a 3 pièces', () => expect(state.players.map((p) => p.coins)).toEqual([3, 3, 3]))
    And('chaque joueur a une merveille différente, sans étape construite', () => {
      expect(new Set(state.players.map((p) => p.wonder.name)).size).toBe(3)
      expect(state.players.map((p) => p.stagesBuilt)).toEqual([0, 0, 0])
    })
  })

  Scenario('Construire une carte gratuite', ({ When, Then, And }) => {
    When('"alice" construit "Chantier"', () => act('alice', { type: 'build', card: 'Chantier' }))
    Then('"alice" produit du bois', () => {
      expect(player('alice').built.flatMap((c) => c.produces ?? [])).toContain('wood')
    })
    And('"alice" a 3 pièces', () => expect(player('alice').coins).toBe(3))
  })

  Scenario('Acheter la ressource manquante à un voisin', ({ Given, When, Then }) => {
    Given('"IA 1" qui produit de la pierre', () => {
      player('IA 1').built.push(findCard('Cavité'))
      // Mock : on vérifie ce que le moteur demande au convertisseur, tout en gardant le taux figé.
      converter = { toCoins: vi.fn(fixedRate(2).toCoins) }
    })
    When('"alice" construit "Bains"', () => {
      act('alice', { type: 'build', card: 'Bains' })
      // Chaque étape est un test : les appels du mock sont relevés ici, avant d'être remis à zéro.
      priceRequests = [...vi.mocked(converter.toCoins).mock.calls]
    })
    Then('"alice" a payé 2 pièces à "IA 1" pour 1 pierre', () => {
      expect(priceRequests).toEqual([['stone', 1]])
      expect(player('alice').coins).toBe(1)
      expect(player('IA 1').coins).toBe(5)
    })
  })

  ScenarioOutline('Une carte impossible à construire est refusée', ({ Given, When, Then }, variables) => {
    Given('"alice" qui a <pièces> pièces et a construit "<déjà construite>"', () => {
      player('alice').coins = Number(variables['pièces'])
      if (variables['déjà construite'] !== 'aucune') player('alice').built.push(findCard(variables['déjà construite']))
    })
    When('"alice" essaie de construire "<carte>"', () => attempt('alice', { type: 'build', card: variables.carte }))
    Then('l\'action est refusée : "<raison>"', () => expect(refusal).toBe(variables.raison))
  })

  Scenario('Une chaîne rend la construction gratuite', ({ Given, When, Then }) => {
    Given('"alice" qui a construit "Bains" et qui a "Aqueduc" en main', () => {
      player('alice').built.push(findCard('Bains'))
      state.hands[seat('alice')][0] = { ...findCard('Aqueduc') }
    })
    When('"alice" construit "Aqueduc"', () => act('alice', { type: 'build', card: 'Aqueduc' }))
    Then('"alice" a construit "Aqueduc" sans rien payer', () => {
      expect(player('alice').built.map((c) => c.name)).toContain('Aqueduc')
      expect(player('alice').coins).toBe(3)
    })
  })

  Scenario('Construire une étape de merveille avec une carte', ({ When, Then, And }) => {
    When('"alice" construit une étape de sa merveille avec "Bains"', () =>
      act('alice', { type: 'wonder', card: 'Bains' }),
    )
    Then('la merveille de "alice" a 1 étape construite', () => expect(player('alice').stagesBuilt).toBe(1))
    And('"Bains" n\'est ni construite ni défaussée', () => {
      expect(player('alice').built.map((c) => c.name)).not.toContain('Bains')
      expect(state.discards).toEqual([])
    })
  })

  Scenario("Une merveille terminée n'accepte plus d'étape", ({ Given, When, Then }) => {
    Given('"alice" dont la merveille est terminée', () => {
      player('alice').stagesBuilt = player('alice').wonder.stages.length
    })
    When('"alice" essaie de construire une étape de sa merveille avec "Bains"', () =>
      attempt('alice', { type: 'wonder', card: 'Bains' }),
    )
    Then('l\'action est refusée : "Ta merveille est déjà terminée."', () => {
      expect(refusal).toBe('Ta merveille est déjà terminée.')
    })
  })

  Scenario('Défausser une carte rapporte 3 pièces', ({ When, Then, And }) => {
    When('"alice" défausse "Bains"', () => act('alice', { type: 'discard', card: 'Bains' }))
    Then('"alice" a 6 pièces', () => expect(player('alice').coins).toBe(6))
    And('la défausse contient "Bains"', () => expect(state.discards.map((c) => c.name)).toEqual(['Bains']))
  })

  Scenario("Jouer un exemplaire d'une carte laisse l'autre dans la main", ({ Given, When, Then }) => {
    Given('"alice" qui a deux "Chantier" en main', () => {
      state.hands[seat('alice')][1] = state.hands[seat('alice')][0]
    })
    When('"alice" défausse "Chantier"', () => act('alice', { type: 'discard', card: 'Chantier' }))
    Then('la main transmise à "IA 2" contient encore un "Chantier"', () => {
      expect(handNames(state, seat('IA 2')).filter((name) => name === 'Chantier')).toHaveLength(1)
    })
  })

  ScenarioOutline("Les mains passent au voisin selon l'âge", ({ Given, When, Then }, variables) => {
    Given("la partie à l'âge <âge>", () => {
      state = { ...state, age: Number(variables['âge']) as GameState['age'] }
    })
    When('chaque joueur défausse une carte différente', () => {
      play(state.players.map((_, i) => ({ type: 'discard', card: state.hands[i][i].name })))
    })
    Then('"alice" reçoit la main de "<voisin>"', () => {
      const from = seat(variables.voisin)
      const expected = handNames(before, from).filter((_, i) => i !== from)
      expect(handNames(state, seat('alice'))).toEqual(expected)
    })
  })

  Scenario("Les conflits militaires sont résolus à la fin de l'âge", ({ Given, When, Then, And }) => {
    Given('"alice" qui a construit "Palissade"', () => {
      player('alice').built.push(findCard('Palissade'))
    })
    When("l'âge I se termine", () => {
      while (state.age === 1) play(state.players.map((_, i) => ({ type: 'discard', card: state.hands[i][0].name })))
    })
    Then('les jetons militaires sont alice 2, IA 1 -1 et IA 2 -1', () => {
      expect(state.players.map((p) => p.military)).toEqual([2, -1, -1])
      expect(state.conflicts).toEqual([2, -1, -1])
    })
    And('les dernières cartes des mains rejoignent la défausse', () => {
      // 6 tours × 3 défausses + la dernière carte de chaque main : les 21 cartes de l'âge.
      expect(state.discards).toHaveLength(21)
    })
    And("l'âge II commence avec 7 cartes en main", () => {
      expect([state.age, state.turn, state.hands[0].length]).toEqual([2, 1, 7])
    })
  })

  Scenario('Une guilde compte les bâtiments des voisins', ({ Given, And, Then }) => {
    Given('"IA 1" qui a construit "Chantier" et "Verrerie" et "IA 2" qui a construit "Cavité"', () => {
      player('IA 1').built.push(findCard('Chantier'), findCard('Verrerie'))
      player('IA 2').built.push(findCard('Cavité'))
    })
    And('"alice" qui a construit "Guilde des bâtisseurs"', () => {
      player('alice').built.push(findCard('Guilde des bâtisseurs'))
    })
    Then('"alice" marque 3 points de guilde', () => {
      expect(finalScore(state.players, seat('alice')).guilds).toBe(3)
    })
  })

  Scenario("La partie se termine après l'âge III avec un classement", ({ When, Then, And }) => {
    When('les IA jouent les trois âges à la place de chaque joueur', () => {
      while (!state.over) play(state.players.map((_, i) => chooseAction(state, i, converter)))
    })
    Then('la partie est terminée', () => expect(state.over).toBe(true))
    And('le classement est trié par score puis par pièces', () => {
      const ranked = ranking(state.players)
      const sorted = [...ranked].sort((a, b) => b.score.total - a.score.total || b.coins - a.coins)
      expect(ranked).toEqual(sorted)
    })
  })
})
