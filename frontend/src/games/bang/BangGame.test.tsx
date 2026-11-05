// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { createGameContext } from '../sdk'
import { fakeDeps } from '../testing/fakes'
import BangGame from './BangGame'

afterEach(() => {
  cleanup()
  sessionStorage.clear()
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
