// @vitest-environment jsdom
import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { expect, vi } from 'vitest'
import { fourPlayerView } from './vue-fixture'

// L'API d'Antoine est remplacée par un faux en mémoire : seul le déroulement de l'écran est testé.
const server = vi.hoisted(() => ({ started: false, sent: [] as string[], view: undefined as unknown }))

vi.mock('../api', async () => {
  const { ApiError } = await import('@/lib/api')
  return {
    createTable: async () => ({ code: 'ABC123', seat: 1, playerCount: 1 }),
    joinTable: async () => ({ code: 'ABC123', seat: 2, playerCount: 2 }),
    startGame: async () => {
      server.started = true
    },
    getView: async () => {
      if (!server.started) throw new ApiError(409, "La partie n'a pas démarré.")
      return server.view
    },
    draw: async () => {
      server.sent.push('draw')
    },
    endTurn: async () => {
      server.sent.push('end')
    },
    discard: async (_code: string, cardId: string) => {
      server.sent.push(`discard:${cardId}`)
    },
  }
})

const { OnlineTable } = await import('../OnlineTable')
const feature = await loadFeature('src/games/bang/features/partie.feature', { language: 'fr' })

function open() {
  cleanup()
  server.started = false
  server.sent = []
  render(createElement(OnlineTable))
}

describeFeature(feature, ({ Scenario }) => {
  Scenario('Créer une table affiche le code à partager', ({ When, Then, And }) => {
    When('je crée une table', async () => {
      open()
      fireEvent.click(screen.getByRole('button', { name: 'Créer une table' }))
    })
    Then('le code "ABC123" est affiché pour les autres joueurs', async () => {
      expect(await screen.findByText('ABC123')).toBeTruthy()
    })
    And("le plateau n'est pas encore affiché", () => {
      expect(screen.queryByRole('region', { name: 'Ta main' })).toBeNull()
    })
  })

  Scenario('Une fois la partie démarrée, je pioche à mon tour', ({ Given, When, Then, And }) => {
    Given("c'est à mon tour de piocher", () => {
      server.view = { ...fourPlayerView(), currentSeat: 1, phase: 'DRAW' }
    })
    When('je crée une table et je démarre la partie', async () => {
      open()
      fireEvent.click(screen.getByRole('button', { name: 'Créer une table' }))
      fireEvent.click(await screen.findByRole('button', { name: 'Démarrer la partie' }))
    })
    Then('le plateau est affiché', async () => {
      expect(await screen.findByRole('region', { name: 'Ta main' })).toBeTruthy()
    })
    And('piocher envoie la pioche au serveur', async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Piocher' }))
      await vi.waitFor(() => expect(server.sent).toEqual(['draw']))
    })
  })
})
