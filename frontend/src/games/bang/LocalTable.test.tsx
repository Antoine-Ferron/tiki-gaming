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
    const handoff = screen.queryByRole('button', { name: `Afficher la main de la place ${seat}` })
    if (handoff) fireEvent.click(handoff)
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
  const handoff = screen.queryByRole('button', { name: 'Afficher la main de la place 1' })
  if (handoff) fireEvent.click(handoff)
  expect(within(screen.getByRole('region', { name: 'Tapis de la place 1' })).getByText('Devant toi')).toBeTruthy()
})

test('tirer dépense un BANG ! puis masque les mains et rôles privés avant de passer à la cible', () => {
  render(<LocalTable />)
  fireEvent.click(screen.getByRole('button', { name: 'Piocher' }))
  const hand = within(screen.getByRole('region', { name: 'Ta main' }))
  expect(hand.getAllByRole('listitem')).toHaveLength(7)
  fireEvent.click(hand.getAllByRole('button', { name: 'BANG !' })[0])
  fireEvent.click(screen.getByRole('button', { name: 'Viser la place 2' }))
  expect(within(screen.getByRole('region', { name: 'Tapis de la place 1' })).getByText('6 en main')).toBeTruthy()
  expect(screen.queryByRole('region', { name: 'Ta main' })).toBeNull()
  expect(screen.queryByText('Rôle privé')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Afficher la main de la place 2' }))
  expect(screen.getByRole('status').textContent).toBe('La place 1 te vise : esquive ou accepte le tir.')
})

test('la cible esquive avec sa carte autorisée, conserve ses PV et rend le même tour au tireur', () => {
  render(<LocalTable />)
  fireEvent.click(screen.getByRole('button', { name: 'Piocher' }))
  fireEvent.click(within(screen.getByRole('region', { name: 'Ta main' })).getAllByRole('button', { name: 'BANG !' })[0])
  fireEvent.click(screen.getByRole('button', { name: 'Viser la place 2' }))
  fireEvent.click(screen.getByRole('button', { name: 'Afficher la main de la place 2' }))
  fireEvent.click(screen.getAllByRole('button', { name: 'Esquiver avec BANG !' })[0])
  const target = within(screen.getByRole('region', { name: 'Tapis de la place 2' }))
  expect(target.getByText('3 en main')).toBeTruthy()
  expect(target.getByText('4/4 PV')).toBeTruthy()
  expect(screen.queryByRole('region', { name: 'Ta main' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Afficher la main de la place 1' }))
  expect(screen.getByRole('status').textContent).toContain('À toi de jouer : choisis un BANG !')
  expect(within(screen.getByRole('region', { name: 'Ta main' })).getAllByRole('listitem')).toHaveLength(6)
})
