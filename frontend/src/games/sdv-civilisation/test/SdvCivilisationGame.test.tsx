// @vitest-environment jsdom
import { Suspense } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { GameError } from '@/games/errors'
import { createGameContext } from '@/games/sdk'
import { fakeDeps, FakeScores } from '@/games/testing/fakes'
import sdvCivilisation from '..'
import SdvCivilisationGame from '../SdvCivilisationGame'

afterEach(cleanup)

const ctx = createGameContext(sdvCivilisation, { id: 'p1', username: 'alice' }, fakeDeps())

describe('SdvCivilisationGame', () => {
  it('assoit le joueur connecté autour de la table avec deux IA', async () => {
    render(<SdvCivilisationGame ctx={ctx} />)

    const seats = within(screen.getByRole('list', { name: 'Table de jeu' })).getAllByRole('listitem')
    expect(seats.map((seat) => seat.getAttribute('aria-label'))).toEqual([
      'alice (toi), 1 pièce, voisin de gauche IA 2, voisin de droite IA 1',
      'IA 1, 1 pièce, voisin de gauche alice, voisin de droite IA 2',
      'IA 2, 1 pièce, voisin de gauche IA 1, voisin de droite alice',
    ])
    expect(screen.getByText('Âge I')).toBeTruthy()
    expect(screen.getAllByRole('img', { name: 'Carte face cachée' })).toHaveLength(7)
    expect(await screen.findByText('Classement')).toBeTruthy()
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
    render(<SdvCivilisationGame ctx={ctx} />)

    fireEvent.click(screen.getByRole('button', { name: 'Plein écran' }))
    const board = document.querySelector('.sdv-civilisation-board')
    Object.defineProperty(document, 'fullscreenElement', { value: board, configurable: true })
    fireEvent(document, new Event('fullscreenchange'))
    fireEvent.click(screen.getByRole('button', { name: 'Quitter le plein écran' }))

    expect(requestFullscreen).toHaveBeenCalledOnce()
    expect(exitFullscreen).toHaveBeenCalledOnce()
  })
})
