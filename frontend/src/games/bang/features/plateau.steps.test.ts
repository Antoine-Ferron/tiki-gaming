// @vitest-environment jsdom
import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber'
import { cleanup, render, screen, within } from '@testing-library/react'
import { createElement } from 'react'
import { expect } from 'vitest'
import { BangBoard } from '../board/BangBoard'
import { positionOf, type GameView, type Position } from '../board/view'
import { fourPlayerView } from './vue-fixture'

const feature = await loadFeature('src/games/bang/features/plateau.feature', { language: 'fr' })

const POSITIONS: Record<string, Position> = {
  'en bas': 'bottom',
  'à gauche': 'left',
  'en haut': 'top',
  'à droite': 'right',
}

/** Chaque étape est un test à part : on nettoie le rendu précédent juste avant d'afficher, pas entre deux étapes. */
function show(view: GameView) {
  cleanup()
  render(createElement(BangBoard, { view }))
}

const mat = (seat: string) => screen.getByRole('region', { name: `Tapis de la place ${seat}` })

describeFeature(feature, ({ Scenario, ScenarioOutline }) => {
  ScenarioOutline('Les tapis sont placés autour du plateau à partir de ma place', ({ When, Then }, variables) => {
    let mySeat: number

    When('je suis à la place <moi>', () => {
      mySeat = Number(variables.moi)
    })
    Then('la place <place> est affichée <position>', () => {
      expect(positionOf(Number(variables.place), mySeat)).toBe(POSITIONS[variables.position])
    })
  })

  ScenarioOutline(
    'Chaque tapis montre le personnage, les PV et le nombre de cartes en main',
    ({ Given, When, Then }, variables) => {
      Given('une partie à quatre joueurs où je suis à la place 1', () => {})
      When('le plateau est affiché', () => {
        show(fourPlayerView())
      })
      Then('le tapis de la place <place> montre "<personnage>", "<pv>" et "<main>"', () => {
        const tapis = within(mat(variables.place))
        expect(tapis.getByText(variables.personnage)).toBeTruthy()
        expect(tapis.getByText(variables.pv)).toBeTruthy()
        expect(tapis.getByText(variables.main)).toBeTruthy()
      })
    },
  )

  ScenarioOutline(
    'Seuls le rôle public du Shérif et mon propre rôle sont visibles',
    ({ Given, When, Then }, variables) => {
      Given('une partie à quatre joueurs où je suis à la place 1', () => {})
      When('le plateau est affiché', () => {
        show(fourPlayerView())
      })
      Then('le tapis de la place <place> indique "<rôle>"', () => {
        expect(within(mat(variables.place)).getByText(variables['rôle'])).toBeTruthy()
      })
    },
  )

  Scenario('Une carte posée apparaît sur le tapis de son joueur', ({ Given, And, When, Then }) => {
    const view = fourPlayerView()

    Given('une partie à quatre joueurs où je suis à la place 1', () => {})
    And('une Planque posée devant la place 3', () => {
      view.players[2].playedCards = [{ id: 'HIDEOUT-1', type: 'HIDEOUT' }]
    })
    When('le plateau est affiché', () => {
      show(view)
    })
    Then('le tapis de la place 3 montre la carte posée "Planque"', () => {
      expect(within(mat('3')).getByRole('list', { name: 'Cartes posées' }).textContent).toContain('Planque')
    })
    And("le tapis de la place 2 n'a aucune carte posée", () => {
      expect(within(mat('2')).queryAllByRole('listitem')).toHaveLength(0)
    })
  })

  Scenario('Je vois ma main, et des autres seulement le nombre de cartes', ({ Given, When, Then, And }) => {
    Given('une partie à quatre joueurs où je suis à la place 1', () => {})
    When('le plateau est affiché', () => {
      show(fourPlayerView())
    })
    Then('ma main montre "BANG !" et "Raté !"', () => {
      const hand = within(screen.getByRole('region', { name: 'Ta main' }))
      expect(hand.getAllByText('BANG !')).toHaveLength(2)
      expect(hand.getByText('Raté !')).toBeTruthy()
    })
    And('aucun tapis adverse ne montre de carte de sa main', () => {
      for (const seat of ['2', '3', '4']) {
        expect(within(mat(seat)).queryByText('BANG !')).toBeNull()
        expect(within(mat(seat)).queryByText('Raté !')).toBeNull()
      }
    })
  })
})
