// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { LocalTable } from './LocalTable'

// Seul le mélange est contrôlé ; la donne, les vues et les tours restent réels.
vi.mock('./local', async (importOriginal) => {
  const local = await importOriginal<typeof import('./local')>()
  return { ...local, deal: () => local.deal((items) => items) }
})

afterEach(cleanup)

test('le même siège reste le seul Shérif quand les quatre joueurs se passent le plateau local', () => {
  render(<LocalTable />)
  for (const seat of [1, 2, 3, 4]) {
    const mats = screen.getAllByRole('region', { name: /^Tapis de la place/ })
    const sheriffSeats = new Set(
      mats
        .filter((mat) => within(mat).queryByText('Shérif', { exact: true }))
        .map((mat) => mat.getAttribute('aria-label')),
    )
    expect([...sheriffSeats]).toEqual(['Tapis de la place 1'])
    expect(
      within(screen.getByRole('region', { name: `Tapis de la place ${seat}` })).getByText('Devant toi'),
    ).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Piocher' }))
    fireEvent.click(screen.getByRole('button', { name: 'Finir le tour' }))
    for (let card = 0; card < 2; card++) {
      const hand = within(screen.getByRole('region', { name: 'Ta main' }))
      fireEvent.click(hand.getAllByRole('button', { name: /^(BANG !|Raté !)$/ })[0])
    }
    fireEvent.click(screen.getByRole('button', { name: 'Finir le tour' }))
  }
  expect(within(screen.getByRole('region', { name: 'Tapis de la place 1' })).getByText('Devant toi')).toBeTruthy()
})
