// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { createGameContext } from '@/games/sdk'
import { fakeDeps } from '@/games/testing/fakes'
import sdvCivilisation from '..'
import SdvCivilisationGame from '../SdvCivilisationGame'

afterEach(cleanup)

describe('SdvCivilisationGame', () => {
  it('assoit le joueur connecté autour de la table avec deux IA', async () => {
    const ctx = createGameContext(sdvCivilisation, { id: 'p1', username: 'alice' }, fakeDeps())

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
})
