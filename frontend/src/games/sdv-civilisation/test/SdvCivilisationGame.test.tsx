// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { createGameContext } from '@/games/sdk'
import { fakeDeps } from '@/games/testing/fakes'
import sdvCivilisation from '..'
import SdvCivilisationGame from '../SdvCivilisationGame'

afterEach(cleanup)

describe('SdvCivilisationGame', () => {
  it('installe le joueur connecté à la table avec deux IA', async () => {
    const ctx = createGameContext(sdvCivilisation, { id: 'p1', username: 'alice' }, fakeDeps())

    render(<SdvCivilisationGame ctx={ctx} />)

    const rows = within(screen.getByRole('table', { name: 'Table de jeu' }))
      .getAllByRole('row')
      .slice(1)
    expect(rows.map((row) => row.textContent)).toEqual(['alice (toi)1IA 2IA 1', 'IA 11aliceIA 2', 'IA 21IA 1alice'])
    expect(screen.getByText('Âge 1 · Tour 1')).toBeTruthy()
    expect(await screen.findByText('Classement')).toBeTruthy()
  })
})
