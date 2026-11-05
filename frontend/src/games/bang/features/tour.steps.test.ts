// @vitest-environment jsdom
import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { createElement } from 'react'
import { expect } from 'vitest'
import { BangBoard } from '../board/BangBoard'
import { turnHint, type GameView, type Phase } from '../board/view'
import { fourPlayerView } from './vue-fixture'

const feature = await loadFeature('src/games/bang/features/tour.feature', { language: 'fr' })

/** Chaque étape est un test à part : on nettoie le rendu précédent juste avant d'afficher. */
function show(
  view: GameView,
  handlers: { onDiscard?: (cardId: string) => void; onDraw?: () => void; onEnd?: () => void } = {},
) {
  cleanup()
  render(createElement(BangBoard, { view, onDiscard: () => {}, ...handlers }))
}

const handButtons = () => within(screen.getByRole('region', { name: 'Ta main' })).queryAllByRole('button')

describeFeature(feature, ({ Scenario, ScenarioOutline }) => {
  ScenarioOutline(
    "Le plateau m'indique quoi faire selon la phase et mes cartes",
    ({ Given, When, Then }, variables) => {
      const view = fourPlayerView()
      let hint = ''

      Given("c'est à la place <actif> de jouer, en phase <phase>, avec <main> cartes en main", () => {
        view.currentSeat = Number(variables.actif)
        view.phase = variables.phase as Phase
        view.hand = Array.from({ length: Number(variables.main) }, (_, i) => ({ id: `BANG-${i + 1}`, type: 'BANG' }))
      })
      When('je regarde le plateau depuis la place 1', () => {
        hint = turnHint(view)
      })
      Then('le plateau m\'indique "<message>"', () => {
        expect(hint).toBe(variables.message)
      })
    },
  )

  Scenario('En phase de défausse, je défausse la carte que je choisis', ({ Given, When, Then }) => {
    const view = fourPlayerView()
    // Un tableau plutôt qu'un mock : l'historique d'un mock est vidé entre deux étapes.
    const discarded: string[] = []

    Given("c'est à la place 1 de jouer, en phase DISCARD", () => {
      view.currentSeat = 1
      view.phase = 'DISCARD'
    })
    When('je défausse "Raté !"', () => {
      show(view, { onDiscard: (cardId) => discarded.push(cardId) })
      fireEvent.click(screen.getByRole('button', { name: 'Raté !' }))
    })
    Then('la défausse de la carte "MISSED-1" est demandée', () => {
      expect(discarded).toEqual(['MISSED-1'])
    })
  })

  Scenario('Hors phase de défausse, mes cartes ne se défaussent pas', ({ Given, When, Then }) => {
    const view = fourPlayerView()

    Given("c'est à la place 1 de jouer, en phase PLAY", () => {
      view.currentSeat = 1
    })
    When('je regarde le plateau depuis la place 1', () => {
      show(view)
    })
    Then('aucune carte de ma main ne peut être défaussée', () => {
      expect(handButtons()).toHaveLength(0)
    })
  })

  Scenario('Je pioche en cliquant sur la pioche du plateau', ({ Given, When, Then }) => {
    const view = fourPlayerView()
    // Un tableau plutôt qu'un mock : l'historique d'un mock est vidé entre deux étapes.
    const draws: string[] = []

    Given("c'est à la place 1 de jouer, en phase DRAW", () => {
      view.currentSeat = 1
      view.phase = 'DRAW'
    })
    When('je clique sur la pioche', () => {
      show(view, { onDraw: () => draws.push('draw') })
      fireEvent.click(screen.getByRole('button', { name: 'Piocher' }))
    })
    Then('la pioche est demandée', () => {
      expect(draws).toEqual(['draw'])
    })
  })

  Scenario("Hors de ma phase de pioche, la pioche n'est pas cliquable", ({ Given, When, Then }) => {
    const view = fourPlayerView()

    Given("c'est à la place 1 de jouer, en phase PLAY", () => {
      view.currentSeat = 1
    })
    When('je regarde le plateau depuis la place 1', () => {
      show(view, { onDraw: () => {} })
    })
    Then("la pioche n'est pas cliquable", () => {
      expect(screen.queryByRole('button', { name: 'Piocher' })).toBeNull()
    })
  })

  Scenario('Je finis mon tour depuis ma main', ({ Given, When, Then }) => {
    const view = fourPlayerView()
    const ends: string[] = []

    Given("c'est à la place 1 de jouer, en phase PLAY", () => {
      view.currentSeat = 1
    })
    When('je clique sur "Finir le tour"', () => {
      show(view, { onEnd: () => ends.push('end') })
      fireEvent.click(screen.getByRole('button', { name: 'Finir le tour' }))
    })
    Then('la fin du tour est demandée', () => {
      expect(ends).toEqual(['end'])
    })
  })

  Scenario('Pendant ma phase de pioche, je ne peux pas finir mon tour', ({ Given, When, Then }) => {
    const view = fourPlayerView()

    Given("c'est à la place 1 de jouer, en phase DRAW", () => {
      view.currentSeat = 1
      view.phase = 'DRAW'
    })
    When('je regarde le plateau depuis la place 1', () => {
      show(view, { onEnd: () => {} })
    })
    Then('le bouton "Finir le tour" n\'est pas proposé', () => {
      expect(screen.queryByRole('button', { name: 'Finir le tour' })).toBeNull()
    })
  })
})
