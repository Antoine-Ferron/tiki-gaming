// @vitest-environment jsdom
import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { createElement } from 'react'
import { expect } from 'vitest'
import { BangBoard } from '../board/BangBoard'
import type { GameView, Phase } from '../board/view'
import { fourPlayerView } from './vue-fixture'

const feature = await loadFeature('src/games/bang/features/tir.feature', { language: 'fr' })

/** Chaque étape est un test à part : on nettoie le rendu précédent juste avant d'afficher. */
function show(view: GameView, onShoot: (cardId: string, targetSeat: number) => void = () => {}) {
  cleanup()
  render(createElement(BangBoard, { view, onShoot }))
}

const bangButtons = () =>
  within(screen.getByRole('region', { name: 'Ta main' })).queryAllByRole('button', { name: 'BANG !' })
const aimButton = (seat: number) => screen.queryByRole('button', { name: `Viser la place ${seat}` })

describeFeature(feature, ({ Scenario, ScenarioOutline }) => {
  ScenarioOutline('Je ne peux choisir un BANG ! que pendant ma phase de jeu', ({ Given, When, Then }, variables) => {
    const view = fourPlayerView()

    Given("c'est à la place <actif> de jouer, en phase <phase>", () => {
      view.currentSeat = Number(variables.actif)
      view.phase = variables.phase as Phase
    })
    When('le plateau est affiché pour la place 1', () => {
      show(view)
    })
    Then('je peux choisir un BANG ! : <possible>', () => {
      expect(bangButtons().length > 0).toBe(variables.possible === 'oui')
    })
  })

  Scenario('Choisir un BANG ! puis une cible déclenche le tir', ({ Given, When, And, Then }) => {
    const view = fourPlayerView()
    // Un tableau plutôt qu'un mock : l'historique d'un mock est vidé entre deux étapes.
    const shots: [string, number][] = []

    Given("c'est à la place 1 de jouer, en phase PLAY", () => {
      view.currentSeat = 1
    })
    When('je choisis le premier BANG ! de ma main', () => {
      show(view, (cardId, seat) => shots.push([cardId, seat]))
      fireEvent.click(bangButtons()[0])
    })
    And('je vise la place 2', () => {
      fireEvent.click(aimButton(2)!)
    })
    Then('le tir est demandé avec la carte "BANG-1" sur la place 2', () => {
      expect(shots).toEqual([['BANG-1', 2]])
    })
  })

  Scenario('Un adversaire éliminé ne peut pas être visé', ({ Given, And, When, Then }) => {
    const view = fourPlayerView()

    Given("c'est à la place 1 de jouer, en phase PLAY", () => {
      view.currentSeat = 1
    })
    And('la place 3 est éliminée', () => {
      view.players[2].health = 0
    })
    When('je choisis le premier BANG ! de ma main', () => {
      show(view)
      fireEvent.click(bangButtons()[0])
    })
    Then('je peux viser les places 2 et 4, mais pas la place 3', () => {
      expect(aimButton(2)).not.toBeNull()
      expect(aimButton(4)).not.toBeNull()
      expect(aimButton(3)).toBeNull()
    })
  })
})
