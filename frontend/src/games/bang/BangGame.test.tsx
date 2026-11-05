// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { createGameContext } from '../sdk'
import { FakeScores, MemoryStorage, fakeDeps } from '../testing/fakes'
import BangGame from './BangGame'

afterEach(() => {
  cleanup()
  sessionStorage.clear()
  vi.restoreAllMocks()
})

test.each([true, false])('les deux modes sont accessibles avec isGuest=%s', (isGuest) => {
  const ctx = createGameContext({ slug: 'bang' }, isGuest ? null : { id: 'compte', username: 'joueur' }, fakeDeps())
  render(<BangGame ctx={ctx} />)
  fireEvent.click(screen.getByRole('button', { name: 'En ligne' }))
  expect(screen.getByRole('button', { name: 'Créer une table' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Sur le même écran' }))
  expect(screen.getByRole('button', { name: 'Piocher' })).toBeTruthy()
})

test('actualiser conserve le choix En ligne pour un invité', () => {
  const ctx = createGameContext({ slug: 'bang' }, null, fakeDeps())
  const first = render(<BangGame ctx={ctx} />)
  fireEvent.click(screen.getByRole('button', { name: 'En ligne' }))
  first.unmount()
  render(<BangGame ctx={ctx} />)
  expect(screen.getByRole('button', { name: 'Créer une table' })).toBeTruthy()
})

test.each([true, false])('un détour en ligne conserve le tour local avec isGuest=%s', (isGuest) => {
  const random = vi.spyOn(Math, 'random').mockReturnValue(0.85)
  const scores = new FakeScores()
  const storage = new MemoryStorage()
  const ctx = createGameContext(
    { slug: 'bang' },
    isGuest ? null : { id: 'compte', username: 'joueur' },
    fakeDeps({ scores, storage }),
  )
  render(<BangGame ctx={ctx} />)
  fireEvent.click(screen.getByRole('button', { name: 'Sur le même écran' }))
  fireEvent.click(screen.getByRole('button', { name: 'Piocher' }))
  const cards = screen.getAllByRole('listitem').map((card) => card.textContent)
  expect(cards).toHaveLength(7)
  const status = screen.getByRole('status').textContent
  const mats = screen.getAllByRole('region', { name: /^Tapis/ }).map((mat) => mat.textContent)
  const shuffles = random.mock.calls.length

  fireEvent.click(screen.getByRole('button', { name: 'En ligne' }))
  expect(screen.queryByRole('region', { name: 'Ta main' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Sur le même écran' }))

  expect(screen.getAllByRole('listitem').map((card) => card.textContent)).toEqual(cards)
  expect(screen.getAllByRole('region', { name: /^Tapis/ }).map((mat) => mat.textContent)).toEqual(mats)
  expect(screen.getByRole('status').textContent).toBe(status)
  expect(random.mock.calls).toHaveLength(shuffles)
  expect(screen.getByRole('button', { name: 'Finir le tour' })).toBeTruthy()
  expect(scores.rows).toEqual([])
  expect([...storage.items.keys()].filter((key) => key.startsWith('tiki:pending-scores:'))).toEqual([])
})

test.each([true, false])(
  'le détour ne révèle pas la main pendant les deux passages d’écran avec isGuest=%s',
  (isGuest) => {
    vi.spyOn(Math, 'random').mockReturnValue(0.85)
    const ctx = createGameContext({ slug: 'bang' }, isGuest ? null : { id: 'compte', username: 'joueur' }, fakeDeps())
    render(<BangGame ctx={ctx} />)
    fireEvent.click(screen.getByRole('button', { name: 'Sur le même écran' }))
    fireEvent.click(screen.getByRole('button', { name: 'Piocher' }))
    fireEvent.click(screen.getAllByRole('button', { name: 'BANG !' })[0])
    fireEvent.click(screen.getByRole('button', { name: 'Viser la place 2' }))
    for (const seat of [2, 1]) {
      fireEvent.click(screen.getByRole('button', { name: 'En ligne' }))
      expect(screen.queryByRole('region', { name: 'Ta main' })).toBeNull()
      fireEvent.click(screen.getByRole('button', { name: 'Sur le même écran' }))
      expect(screen.getByRole('status').textContent).toBe(`Passe l'écran à la place ${seat}.`)
      expect(screen.queryByRole('region', { name: 'Ta main' })).toBeNull()
      expect(screen.queryByText('Rôle privé')).toBeNull()
      fireEvent.click(screen.getByRole('button', { name: `Afficher la main de la place ${seat}` }))
      if (seat === 2) fireEvent.click(screen.getAllByRole('button', { name: 'Esquiver avec Raté !' })[0])
    }
    expect(screen.getAllByRole('listitem')).toHaveLength(6)
    expect(screen.getByRole('status').textContent).toContain('À toi de jouer : choisis un BANG !')
  },
)
