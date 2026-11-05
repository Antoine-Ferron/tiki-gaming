// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { ApiError } from '@/lib/api'
import { playMove, readMatch, startMatch } from './api'
import DameGame from './DameGame'
import { INITIAL, MOVE, NEXT } from './test-fixtures'
import type { DameView } from './types'

vi.mock('./api', () => ({ startMatch: vi.fn(), readMatch: vi.fn(), playMove: vi.fn() }))
const start = vi.mocked(startMatch)
const read = vi.mocked(readMatch)
const play = vi.mocked(playMove)
const cell = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name},`) })
const savedKey = 'tiki.dame.match'

beforeEach(() => {
  vi.resetAllMocks()
  sessionStorage.clear()
  start.mockResolvedValue(INITIAL)
  read.mockResolvedValue(NEXT)
  play.mockResolvedValue(NEXT)
})
afterEach(() => cleanup())

async function create() {
  render(<DameGame />)
  await screen.findByRole('heading', { name: 'Les joueurs' })
  fireEvent.change(screen.getByLabelText('Joueur blanc'), { target: { value: ' Chérif ' } })
  fireEvent.change(screen.getByLabelText('Joueur noir'), { target: { value: 'Amadou' } })
  fireEvent.click(screen.getByRole('button', { name: 'Commencer la partie' }))
  await screen.findByText('Chérif · Blancs à jouer')
}

test('demande les noms avant toute création puis affiche le damier et envoie un coup sans plateau', async () => {
  await create()
  expect(start).toHaveBeenCalledExactlyOnceWith({ whiteName: 'Chérif', blackName: 'Amadou' })
  expect(sessionStorage.getItem(savedKey)).toBe(INITIAL.id)
  expect(screen.getByRole('group', { name: 'Damier de dix lignes et dix colonnes' })).toBeVisible()
  expect(cell('E7')).toHaveAccessibleName(/dame noir/)
  fireEvent.click(cell('B4'))
  expect(cell('A5')).toHaveAccessibleName(/arrivée possible/)
  fireEvent.click(cell('A5'))
  await screen.findByText('Amadou · Noirs à jouer')
  expect(play).toHaveBeenCalledExactlyOnceWith(INITIAL.id, 0, MOVE)
  expect(cell('B4')).toHaveAccessibleName(/case vide/)
  expect(cell('A5')).toHaveAccessibleName(/pion blanc/)
})

test('explique les noms absents ou trop longs sans appel au serveur', async () => {
  render(<DameGame />)
  const submit = await screen.findByRole('button', { name: 'Commencer la partie' })
  fireEvent.click(submit)
  expect(await screen.findAllByRole('alert')).toHaveLength(2)
  fireEvent.change(screen.getByLabelText('Joueur blanc'), { target: { value: 'a'.repeat(51) } })
  fireEvent.change(screen.getByLabelText('Joueur noir'), { target: { value: 'Amadou' } })
  fireEvent.click(submit)
  expect(await screen.findByText(/50 caractères maximum/)).toBeVisible()
  expect(start).not.toHaveBeenCalled()
})

test('une création refusée conserve les noms et permet de réessayer', async () => {
  start.mockRejectedValueOnce(new ApiError(502, 'Réessaie dans un instant.'))
  render(<DameGame />)
  fireEvent.change(await screen.findByLabelText('Joueur blanc'), { target: { value: 'Chérif' } })
  fireEvent.change(screen.getByLabelText('Joueur noir'), { target: { value: 'Amadou' } })
  fireEvent.click(screen.getByRole('button', { name: 'Commencer la partie' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Réessaie dans un instant.')
  expect(screen.getByLabelText('Joueur blanc')).toHaveValue('Chérif')
  fireEvent.click(screen.getByRole('button', { name: 'Commencer la partie' }))
  await screen.findByText('Chérif · Blancs à jouer')
})

test('une relecture reprend la rencontre de cet onglet sans créer une nouvelle ligne', async () => {
  sessionStorage.setItem(savedKey, INITIAL.id)
  render(<DameGame />)
  await screen.findByText('Amadou · Noirs à jouer')
  expect(read).toHaveBeenCalledWith(INITIAL.id)
  expect(start).not.toHaveBeenCalled()
})

test('une rencontre absente de la session efface seulement son identifiant local', async () => {
  sessionStorage.setItem(savedKey, INITIAL.id)
  read.mockRejectedValue(new ApiError(404, 'Rencontre introuvable.'))
  render(<DameGame />)
  await screen.findByRole('heading', { name: 'Les joueurs' })
  expect(sessionStorage.getItem(savedKey)).toBeNull()
  expect(start).not.toHaveBeenCalled()
})

test('un refus de coup garde le plateau puis actualise sans répéter le POST', async () => {
  play.mockRejectedValueOnce(new ApiError(409, 'La partie a changé.'))
  await create()
  fireEvent.click(cell('B4'))
  fireEvent.click(cell('A5'))
  expect(await screen.findByRole('alert')).toHaveTextContent('La partie a changé.')
  expect(cell('B4')).toHaveAccessibleName(/pion blanc/)
  fireEvent.click(screen.getByRole('button', { name: 'Actualiser la partie' }))
  await screen.findByText('Amadou · Noirs à jouer')
  expect(play).toHaveBeenCalledTimes(1)
  expect(read).toHaveBeenCalledTimes(1)
})

test('une double activation ne soumet qu’une commande en vol', async () => {
  let resolve!: (value: DameView) => void
  play.mockReturnValue(new Promise((done) => (resolve = done)))
  await create()
  fireEvent.click(cell('B4'))
  const arrival = cell('A5')
  fireEvent.click(arrival)
  fireEvent.click(arrival)
  expect(play).toHaveBeenCalledTimes(1)
  expect(arrival).toBeDisabled()
  await act(async () => resolve(NEXT))
  expect(await screen.findByText('Amadou · Noirs à jouer')).toBeVisible()
})

test('le clavier déplace le focus et permet de sélectionner puis annuler', async () => {
  const user = userEvent.setup()
  await create()
  cell('B4').focus()
  await user.keyboard('{Enter}')
  expect(cell('B4')).toHaveAttribute('aria-pressed', 'true')
  await user.keyboard('{ArrowUp}{ArrowLeft}')
  expect(cell('A5')).toHaveFocus()
  fireEvent.click(screen.getByRole('button', { name: 'Annuler la sélection' }))
  expect(cell('B4')).toHaveAttribute('aria-pressed', 'false')
  expect(play).not.toHaveBeenCalled()
})

test('une rafle reste locale jusqu’à la dernière arrivée et conserve les victimes en prévisualisation', async () => {
  const capture = {
    from: MOVE.from,
    landings: [
      { row: 4, column: 3 },
      { row: 2, column: 5 },
    ],
  }
  start.mockResolvedValue({ ...INITIAL, legalMoves: [capture] })
  await create()
  fireEvent.click(cell('B4'))
  fireEvent.click(cell('D6'))
  expect(play).not.toHaveBeenCalled()
  expect(cell('D6')).toHaveAccessibleName(/pion blanc/)
  fireEvent.click(cell('F8'))
  await waitFor(() => expect(play).toHaveBeenCalledExactlyOnceWith(INITIAL.id, 0, capture))
})

test('une victoire vient du serveur et rejouer redemande les noms', async () => {
  play.mockResolvedValue({ ...NEXT, status: 'WHITE_WON', winner: 'WHITE', legalMoves: [], finishedAt: NEXT.startedAt })
  await create()
  fireEvent.click(cell('B4'))
  fireEvent.click(cell('A5'))
  expect(await screen.findByText('Chérif remporte la partie !')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Rejouer' }))
  expect(screen.getByLabelText('Joueur blanc')).toHaveValue('Chérif')
  expect(start).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('button', { name: 'Revenir à la partie' }))
  expect(screen.getByText('Chérif remporte la partie !')).toBeVisible()
})
