// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { OnlineTable } from './OnlineTable'
import { fourPlayerView } from './features/vue-fixture'
import type { GameView } from './board/view'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  document.cookie = 'XSRF-TOKEN=; Max-Age=0; Path=/'
})

test('seule la cible esquive avec sa carte et l’identifiant courant, puis relit les quatre tapis', async () => {
  let view: GameView = {
    ...fourPlayerView(),
    currentSeat: 4,
    pendingShot: { id: 'tir/courant', shooterSeat: 4, targetSeat: 1 },
  }
  const fetch = vi.fn(async (url: string) => {
    if (url.endsWith('/state')) return Response.json(view)
    if (url.endsWith('/shots/tir%2Fcourant/dodge/MISSED-1')) {
      view = {
        ...view,
        pendingShot: undefined,
        hand: view.hand.filter((card) => card.id !== 'MISSED-1'),
        players: view.players.map((p) => (p.seat === 1 ? { ...p, handCount: 2 } : p)),
      }
      return new Response(null, { status: 204 })
    }
    return Response.json({ code: view.code, seat: 1, playerCount: 4 })
  })
  vi.stubGlobal('fetch', fetch)
  render(<OnlineTable />)
  fireEvent.click(screen.getByRole('button', { name: 'Créer une table' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Esquiver avec Raté !' }))

  await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Au tour de la place 4.'))
  expect(fetch).toHaveBeenCalledWith(
    '/api/games/bang/tables/ABC123/shots/tir%2Fcourant/dodge/MISSED-1',
    expect.objectContaining({ method: 'POST' }),
  )
  for (const player of view.players) {
    const mat = within(screen.getByRole('region', { name: `Tapis de la place ${player.seat}` }))
    expect(mat.getByText(`${player.health}/${player.maxHealth} PV`)).toBeTruthy()
    expect(mat.getByText(`${player.handCount} en main`)).toBeTruthy()
  }
  expect(within(screen.getByRole('region', { name: 'Ta main' })).queryByText('Raté !')).toBeNull()
})

test('depuis la partie en ligne, choisir un BANG ! et viser envoie le vrai POST avec le CSRF', async () => {
  const view = { ...fourPlayerView(), currentSeat: 1 }
  const fetch = vi.fn(async (url: string) => {
    if (url.endsWith('/state')) return Response.json(view)
    if (url.endsWith('/shots/BANG-1/targets/2')) return new Response(null, { status: 204 })
    return Response.json({ code: view.code, seat: 1, playerCount: 4 })
  })
  vi.stubGlobal('fetch', fetch)
  document.cookie = 'XSRF-TOKEN=jeton%20test; Path=/'
  render(<OnlineTable />)
  fireEvent.click(screen.getByRole('button', { name: 'Créer une table' }))
  const hand = within(await screen.findByRole('region', { name: 'Ta main' }))
  fireEvent.click(hand.getAllByRole('button', { name: 'BANG !' })[0])
  fireEvent.click(screen.getByRole('button', { name: 'Viser la place 2' }))

  await waitFor(() =>
    expect(fetch).toHaveBeenCalledWith('/api/games/bang/tables/ABC123/shots/BANG-1/targets/2', {
      credentials: 'same-origin',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': 'jeton test' },
      body: '{}',
    }),
  )
})

test('le tireur attend la réponse du tir serveur et ne peut plus jouer ni finir son tour', async () => {
  const view = {
    ...fourPlayerView(),
    currentSeat: 1,
    pendingShot: { id: 'tir-courant', shooterSeat: 1, targetSeat: 2 },
  }
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) =>
      Response.json(url.endsWith('/state') ? view : { code: view.code, seat: 1, playerCount: 4 }),
    ),
  )
  render(<OnlineTable />)
  fireEvent.click(screen.getByRole('button', { name: 'Créer une table' }))
  await screen.findByRole('region', { name: 'Ta main' })

  expect(screen.getByRole('status').textContent).toBe('Tir de la place 1 vers la place 2 : en attente de sa réponse.')
  expect(screen.queryByRole('button', { name: 'Finir le tour' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'BANG !' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Accepter le tir' })).toBeNull()
})

test('accepter applique uniquement la vue reçue, avec les dégâts et le bonus privé de Bart', async () => {
  let view: GameView = {
    ...fourPlayerView(),
    currentSeat: 4,
    pendingShot: { id: 'tir-courant', shooterSeat: 4, targetSeat: 1 },
  }
  const fetch = vi.fn(async (url: string) => {
    if (url.endsWith('/state')) return Response.json(view)
    if (url.endsWith('/shots/tir-courant/accept')) {
      view = {
        ...view,
        pendingShot: undefined,
        hand: [...view.hand, { id: 'bonus-serveur', type: 'MISSED' }],
        players: view.players.map((p) => (p.seat === 1 ? { ...p, health: 3, handCount: 4 } : p)),
      }
      return new Response(null, { status: 204 })
    }
    return Response.json({ code: view.code, seat: 1, playerCount: 4 })
  })
  vi.stubGlobal('fetch', fetch)
  render(<OnlineTable />)
  fireEvent.click(screen.getByRole('button', { name: 'Créer une table' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Accepter le tir' }))

  await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Au tour de la place 4.'))
  expect(fetch).toHaveBeenCalledWith(
    '/api/games/bang/tables/ABC123/shots/tir-courant/accept',
    expect.objectContaining({ method: 'POST' }),
  )
  const mat = within(screen.getByRole('region', { name: 'Tapis de la place 1' }))
  expect(mat.getByText('3/4 PV')).toBeTruthy()
  expect(mat.getByText('4 en main')).toBeTruthy()
  expect(within(screen.getByRole('region', { name: 'Ta main' })).getAllByText('Raté !')).toHaveLength(2)
})

test('deux clics sur accepter pendant la même requête ne lancent qu’une réponse', async () => {
  const view: GameView = {
    ...fourPlayerView(),
    currentSeat: 4,
    pendingShot: { id: 'tir-courant', shooterSeat: 4, targetSeat: 1 },
  }
  let finish!: (response: Response) => void
  const reply = new Promise<Response>((resolve) => {
    finish = resolve
  })
  const fetch = vi.fn(async (url: string) => {
    if (url.endsWith('/state')) return Response.json(view)
    if (url.endsWith('/accept')) return reply
    return Response.json({ code: view.code, seat: 1, playerCount: 4 })
  })
  vi.stubGlobal('fetch', fetch)
  render(<OnlineTable />)
  fireEvent.click(screen.getByRole('button', { name: 'Créer une table' }))
  const accept = await screen.findByRole('button', { name: 'Accepter le tir' })
  fireEvent.click(accept)
  fireEvent.click(accept)
  const replies = fetch.mock.calls.filter(([url]) => url.endsWith('/accept'))
  await act(async () => {
    finish(new Response(null, { status: 204 }))
  })
  expect(replies).toHaveLength(1)
})
