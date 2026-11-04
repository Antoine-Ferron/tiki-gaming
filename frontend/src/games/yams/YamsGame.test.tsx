// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createGameContext } from '../sdk'
import { fakeDeps } from '../testing/fakes'
import { type Game, LOWER_CATEGORIES, type Sheet, UPPER_CATEGORIES } from './logic'
import { saveGame } from './session'
import YamsGame from './YamsGame'

afterEach(cleanup)

const game = { slug: 'yams' }
const player = { id: 'p1', username: 'yanis' }

test('le joueur 1 lance, garde un dé, relance puis choisit une case : la main passe au joueur 2', async () => {
  const ctx = createGameContext(game, player, fakeDeps())
  // Stub du lancer : 3-3-3-6-6 au premier lancer, puis 3-3-6-6 pour les quatre dés relancés
  const faces = [3, 3, 3, 6, 6, 3, 3, 6, 6] as const
  let next = 0
  render(<YamsGame ctx={ctx} rollDie={() => faces[next++]} />)

  fireEvent.click(await screen.findByRole('button', { name: 'Lancer les dés' }))
  fireEvent.click(screen.getByRole('button', { name: 'Dé 1 : 3' }))
  fireEvent.click(screen.getByRole('button', { name: 'Relancer (2)' }))

  expect(screen.getByRole('button', { name: 'Dé 1 : 3, gardé' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Dé 5 : 6' })).toBeTruthy()

  fireEvent.click(screen.getByRole('button', { name: '25' })) // la case Full
  expect(await screen.findByText('Joueur 2', { selector: 'strong' })).toBeTruthy()
})

test('annonce le gagnant et rappelle à l’invité qu’il n’est pas classé', async () => {
  const complete = (value: number): Sheet =>
    Object.fromEntries([...UPPER_CATEGORIES, ...LOWER_CATEGORIES].map((c) => [c, value]))
  const ctx = createGameContext(game, null, fakeDeps())
  const almostOver: Game = { sheets: [complete(5), { ...complete(6), chance: undefined }], current: 1, turn: null }
  await saveGame(ctx, JSON.parse(JSON.stringify(almostOver)))
  render(<YamsGame ctx={ctx} rollDie={() => 6} />)

  fireEvent.click(await screen.findByRole('button', { name: 'Lancer les dés' }))
  fireEvent.click(screen.getByRole('button', { name: '30' }))

  expect(await screen.findByText(/Joueur 2 gagne/)).toBeTruthy()
  expect(screen.getByText('Connecte-toi pour apparaître au classement.')).toBeTruthy()
})
