// @vitest-environment jsdom
import { Suspense } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { GameError } from '@/games/errors'
import { createGameContext } from '@/games/sdk'
import { fakeDeps, FakeScores } from '@/games/testing/fakes'
import sdvCivilisation from '..'
import { SdvCivilisationBoard } from '../SdvCivilisationGame'
import { identityShuffler } from './fakes'

afterEach(cleanup)

// Fake : scores en mémoire. Stub : le mélangeur garde l'ordre du catalogue (main de départ connue).
function setup() {
  const alice = { id: 'p1', username: 'alice' }
  const ctx = createGameContext(sdvCivilisation, alice, fakeDeps({ scores: new FakeScores(alice) }))
  render(<SdvCivilisationBoard ctx={ctx} shuffler={identityShuffler} />)
  return ctx
}

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }))

describe('SdvCivilisationGame', () => {
  it('assoit le joueur autour de la table avec deux IA et lui montre sa main', () => {
    setup()

    const seats = within(screen.getByRole('list', { name: 'Table de jeu' })).getAllByRole('listitem')
    expect(seats.map((seat) => seat.getAttribute('aria-label'))).toEqual([
      'alice (toi), 1 pièce, voisin de gauche IA 2, voisin de droite IA 1',
      'IA 1, 1 pièce, voisin de gauche alice, voisin de droite IA 2',
      'IA 2, 1 pièce, voisin de gauche IA 1, voisin de droite alice',
    ])
    expect(screen.getAllByRole('button', { pressed: false })).toHaveLength(7)
  })

  it('explique pourquoi une carte ne peut pas être construite', () => {
    setup()

    click(/^Bains/)

    expect(screen.getByRole('button', { name: 'Construire Bains' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByText('Il te manque des ressources.')).toBeTruthy()
  })

  it('construit la carte choisie pendant que les IA jouent', () => {
    setup()

    click(/^Chantier/)
    click('Construire Chantier')

    expect(screen.getByText('alice construit Chantier')).toBeTruthy()
    expect(within(screen.getByRole('list', { name: 'Dernier tour' })).getAllByRole('listitem')).toHaveLength(3)
    expect(screen.getByText(/Tour/).textContent).toBe('Âge I · Tour 2 / 6')
  })

  it('envoie le score à chaque fin de partie et affiche un échec d’envoi', async () => {
    const ctx = setup()
    // Mock : le premier envoi échoue, le second passe par le vrai SDK (et ses scores en mémoire).
    const submitScore = vi
      .spyOn(ctx, 'submitScore')
      .mockRejectedValueOnce(new GameError('network', 'Envoi impossible.'))
    const playToTheEnd = () => {
      while (!screen.queryByText('Fin de partie')) {
        fireEvent.click(within(screen.getByText(/^Ta main/).parentElement!).getAllByRole('button')[0])
        click('Défausser (+3 pièces)')
      }
    }

    playToTheEnd()
    expect(await screen.findByText('Envoi impossible.')).toBeTruthy()
    click('Rejouer')
    expect(screen.getByText(/Tour/).textContent).toBe('Âge I · Tour 1 / 6')
    playToTheEnd()

    expect(await screen.findByText('alice', { selector: '.name' })).toBeTruthy()
    expect(submitScore).toHaveBeenCalledTimes(2)
  })

  it('chargé depuis le catalogue, assoit l’invité sous le nom « Toi » et affiche une erreur de classement', async () => {
    const scores = new FakeScores()
    scores.leaderboard = () => Promise.reject(new GameError('network', 'Classement indisponible.'))
    const Game = sdvCivilisation.component
    render(
      <Suspense>
        <Game ctx={createGameContext(sdvCivilisation, null, fakeDeps({ scores }))} />
      </Suspense>,
    )

    expect(await screen.findByText('Classement indisponible.')).toBeTruthy()
    expect(screen.getByText('Toi')).toBeTruthy()
  })

  it('entre et sort du plein écran', () => {
    // jsdom n'implémente pas l'API Fullscreen : on la simule.
    Object.defineProperty(document, 'fullscreenEnabled', { value: true, configurable: true })
    const requestFullscreen = vi.fn(() => Promise.resolve())
    const exitFullscreen = vi.fn(() => Promise.resolve())
    HTMLElement.prototype.requestFullscreen = requestFullscreen
    document.exitFullscreen = exitFullscreen
    setup()

    click('Plein écran')
    const board = document.querySelector('.sdv-civilisation-board')
    Object.defineProperty(document, 'fullscreenElement', { value: board, configurable: true })
    fireEvent(document, new Event('fullscreenchange'))
    click('Quitter le plein écran')

    expect(requestFullscreen).toHaveBeenCalledOnce()
    expect(exitFullscreen).toHaveBeenCalledOnce()
  })
})
