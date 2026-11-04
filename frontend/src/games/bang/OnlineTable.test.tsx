// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { OnlineTable } from './OnlineTable'
import { fourPlayerView } from './features/vue-fixture'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  document.cookie = 'XSRF-TOKEN=; Max-Age=0; Path=/'
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
