// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { createGameContext } from '@/games/sdk'
import { fakeDeps } from '@/games/testing/fakes'
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

  it('met le plateau en plein écran', () => {
    // jsdom n'implémente pas l'API Fullscreen : on la simule.
    Object.defineProperty(document, 'fullscreenEnabled', { value: true, configurable: true })
    const requestFullscreen = vi.fn(() => Promise.resolve())
    HTMLElement.prototype.requestFullscreen = requestFullscreen
    render(<SdvCivilisationGame ctx={ctx} />)

    fireEvent.click(screen.getByRole('button', { name: 'Plein écran' }))

    expect(requestFullscreen).toHaveBeenCalledOnce()
  })
})
