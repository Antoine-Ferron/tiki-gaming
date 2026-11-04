// @vitest-environment jsdom
import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { expect } from 'vitest'
import BangGame from '../BangGame'
import { CHARACTERS, type Character } from '../cards/characters'
import { deal, discard, draw, endTurn, type LocalGame } from '../local'
import type { GameContext } from '../../types'

const feature = await loadFeature('src/games/bang/features/partie-locale.feature', { language: 'fr' })

/** Sans mélange, la donne est connue : le Shérif est à la place 1 avec Bart Cassidy. */
const fresh = () => deal((items) => items)
const active = (game: LocalGame) => game.players.find((p) => p.seat === game.currentSeat)!
const slugOf = (label: string) => (Object.keys(CHARACTERS) as Character[]).find((c) => CHARACTERS[c].label === label)

describeFeature(feature, ({ Scenario, ScenarioOutline }) => {
  ScenarioOutline('Une partie locale distribue un rôle et un personnage à chacun', ({ When, Then }, variables) => {
    let game: LocalGame

    When('une partie locale est distribuée', () => {
      game = fresh()
    })
    Then('la place <place> a le rôle <role>, le personnage "<personnage>", <pv> PV et <main> cartes en main', () => {
      const player = game.players.find((p) => p.seat === Number(variables.place))!
      expect(player.role).toBe(variables.role)
      expect(player.character).toBe(slugOf(variables.personnage))
      expect(player.health).toBe(Number(variables.pv))
      expect(player.hand).toHaveLength(Number(variables.main))
    })
  })

  Scenario('Le Shérif joue en premier, en phase de pioche', ({ When, Then }) => {
    let game: LocalGame

    When('une partie locale est distribuée', () => {
      game = fresh()
    })
    Then("c'est à la place 1 de jouer, en phase DRAW", () => {
      expect([game.currentSeat, game.phase]).toEqual([1, 'DRAW'])
    })
  })

  Scenario('Piocher donne deux cartes et ouvre la phase de jeu', ({ Given, When, Then }) => {
    let game: LocalGame

    Given('une partie locale distribuée', () => {
      game = fresh()
    })
    When('le joueur actif pioche', () => {
      game = draw(game)
    })
    Then('il a 7 cartes en main et la phase est PLAY', () => {
      expect([active(game).hand.length, game.phase]).toEqual([7, 'PLAY'])
    })
  })

  Scenario('Finir son tour avec trop de cartes ouvre la défausse', ({ Given, And, When, Then }) => {
    let game: LocalGame

    Given('une partie locale distribuée', () => {
      game = fresh()
    })
    And('le joueur actif a pioché', () => {
      game = draw(game)
    })
    When('il finit son tour', () => {
      game = endTurn(game)
    })
    Then("la phase est DISCARD et c'est toujours à la place 1 de jouer", () => {
      expect([game.phase, game.currentSeat]).toEqual(['DISCARD', 1])
    })
  })

  Scenario("Défausser jusqu'à ses PV puis finir passe la main au joueur suivant", ({ Given, And, When, Then }) => {
    let game: LocalGame

    Given('une partie locale distribuée', () => {
      game = fresh()
    })
    And('le joueur actif a pioché puis ouvert la défausse', () => {
      game = endTurn(draw(game))
    })
    When('il défausse 2 cartes puis finit son tour', () => {
      for (let i = 0; i < 2; i++) game = discard(game, active(game).hand[0].id)
      game = endTurn(game)
    })
    Then("c'est à la place 2 de jouer, en phase DRAW", () => {
      expect([game.currentSeat, game.phase]).toEqual([2, 'DRAW'])
    })
  })

  Scenario('Finir son tour sans piocher est refusé', ({ Given, When, Then }) => {
    let game: LocalGame
    let refusal = ''

    Given('une partie locale distribuée', () => {
      game = fresh()
    })
    When('le joueur actif finit son tour', () => {
      try {
        endTurn(game)
      } catch (err) {
        refusal = (err as Error).message
      }
    })
    Then('le tour est refusé avec "Pioche d\'abord tes deux cartes."', () => {
      expect(refusal).toBe("Pioche d'abord tes deux cartes.")
    })
  })

  Scenario('Sans compte, la partie démarre tout de suite et je pioche', ({ When, Then, And }) => {
    When("j'ouvre le jeu sans être connecté", () => {
      cleanup()
      render(createElement(BangGame, { ctx: { isGuest: true } as GameContext }))
    })
    Then('le plateau m\'indique "À toi de jouer : pioche tes deux cartes."', () => {
      expect(screen.getByRole('status').textContent).toBe('À toi de jouer : pioche tes deux cartes.')
    })
    And("après avoir pioché, le plateau m'indique de jouer", () => {
      fireEvent.click(screen.getByRole('button', { name: 'Piocher' }))
      expect(screen.getByRole('status').textContent).toContain('choisis un BANG !')
    })
  })
})
