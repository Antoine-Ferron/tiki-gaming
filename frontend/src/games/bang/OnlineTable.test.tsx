// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { OnlineTable } from './OnlineTable'
import { fourPlayerView } from './features/vue-fixture'
import type { GameView } from './board/view'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.useRealTimers()
  document.cookie = 'XSRF-TOKEN=; Max-Age=0; Path=/'
  sessionStorage.clear()
})

test('une lecture PLAY pendant un POST lent ne met pas une deuxième fin de tour en attente', async () => {
  let view: GameView = { ...fourPlayerView(), currentSeat: 1, phase: 'PLAY' }
  let acknowledge!: (response: Response) => void
  const pending = new Promise<Response>((resolve) => {
    acknowledge = resolve
  })
  let ends = 0
  const fetch = vi.fn(async (url: string) => {
    if (url.endsWith('/state')) return Response.json(view)
    if (url.endsWith('/turn/end')) {
      ends++
      return ends === 1 ? pending : Response.json({ error: 'Ce n’est plus ton tour.' }, { status: 403 })
    }
    throw new Error(`Appel inattendu : ${url}`)
  })
  vi.stubGlobal('fetch', fetch)
  vi.useFakeTimers()
  sessionStorage.setItem('tiki:bang:table:compte-test', view.code)
  await act(async () => {
    render(<OnlineTable accountId="compte-test" />)
  })
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Finir le tour' }))
  })
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2000)
  })
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Finir le tour' }))
  })
  view = { ...view, currentSeat: 2, phase: 'DRAW' }
  await act(async () => {
    acknowledge(new Response(null, { status: 204 }))
  })

  expect(ends).toBe(1)
  expect(screen.queryByRole('alert')).toBeNull()
  expect(screen.getByRole('status').textContent).toBe('Au tour de la place 2.')
})

test('un deuxième clic de défausse valide attend le POST lent de la première carte', async () => {
  const cards = Array.from({ length: 7 }, (_, index) => ({ id: `carte-${index}`, type: 'BANG' }))
  let view: GameView = {
    ...fourPlayerView(),
    currentSeat: 1,
    phase: 'DISCARD',
    hand: cards,
    players: fourPlayerView().players.map((p) => (p.seat === 1 ? { ...p, health: 5, maxHealth: 5, handCount: 7 } : p)),
  }
  let acknowledge!: (response: Response) => void
  const pending = new Promise<Response>((resolve) => {
    acknowledge = resolve
  })
  const discarded: string[] = []
  const fetch = vi.fn(async (url: string) => {
    if (url.endsWith('/state')) return Response.json(view)
    if (url.includes('/turn/discard/')) {
      const cardId = url.slice(url.lastIndexOf('/') + 1)
      discarded.push(cardId)
      view = { ...view, hand: view.hand.filter((card) => card.id !== cardId) }
      return discarded.length === 1 ? pending : new Response(null, { status: 204 })
    }
    throw new Error(`Appel inattendu : ${url}`)
  })
  vi.stubGlobal('fetch', fetch)
  vi.useFakeTimers()
  sessionStorage.setItem('tiki:bang:table:compte-test', view.code)
  await act(async () => {
    render(<OnlineTable accountId="compte-test" />)
  })
  const discardFirstVisible = () =>
    fireEvent.click(
      within(screen.getByRole('region', { name: 'Ta main' })).getAllByRole('button', { name: 'BANG !' })[0],
    )
  await act(async () => {
    discardFirstVisible()
  })
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2000)
  })
  await act(async () => {
    discardFirstVisible()
  })
  expect(discarded).toEqual(['carte-0'])
  await act(async () => {
    acknowledge(new Response(null, { status: 204 }))
  })

  expect(discarded).toEqual(['carte-0', 'carte-1'])
  expect(within(screen.getByRole('region', { name: 'Ta main' })).getAllByRole('listitem')).toHaveLength(5)
  expect(screen.queryByRole('alert')).toBeNull()
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
  render(<OnlineTable accountId="compte-test" />)
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
  render(<OnlineTable accountId="compte-test" />)
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
  render(<OnlineTable accountId="compte-test" />)
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
  render(<OnlineTable accountId="compte-test" />)
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
  render(<OnlineTable accountId="compte-test" />)
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

test.each([
  { action: 'tirer', held: 'MISSED', button: 'Raté !', path: '/shots/carte-janet/targets/2' },
  { action: 'esquiver', held: 'BANG', button: 'Esquiver avec BANG !', path: '/shots/tir-courant/dodge/carte-janet' },
])('Calamity Janet peut $action avec $held depuis sa main', async ({ action, held, button, path }) => {
  const view: GameView = {
    ...fourPlayerView(),
    currentSeat: action === 'tirer' ? 1 : 4,
    hand: [{ id: 'carte-janet', type: held }],
    pendingShot: action === 'esquiver' ? { id: 'tir-courant', shooterSeat: 4, targetSeat: 1 } : undefined,
  }
  view.players[0].character = 'CALAMITY_JANET'
  const fetch = vi.fn(async (url: string) => {
    if (url.endsWith('/state')) return Response.json(view)
    if (url.endsWith(path)) return new Response(null, { status: 204 })
    return Response.json({ code: view.code, seat: 1, playerCount: 4 })
  })
  vi.stubGlobal('fetch', fetch)
  render(<OnlineTable accountId="compte-test" />)
  fireEvent.click(screen.getByRole('button', { name: 'Créer une table' }))
  const hand = within(await screen.findByRole('region', { name: 'Ta main' }))
  fireEvent.click(hand.getByRole('button', { name: button }))
  if (action === 'tirer') fireEvent.click(screen.getByRole('button', { name: 'Viser la place 2' }))
  await waitFor(() =>
    expect(fetch).toHaveBeenCalledWith(
      `/api/games/bang/tables/ABC123${path}`,
      expect.objectContaining({ method: 'POST' }),
    ),
  )
})

test.each([1, 3, 4])('la place %i ne répond pas au tir visant la place 2', async (seat) => {
  const view = { ...fourPlayerView(), seat, currentSeat: 1, pendingShot: { id: 'tir', shooterSeat: 1, targetSeat: 2 } }
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) =>
      Response.json(url.endsWith('/state') ? view : { code: view.code, seat, playerCount: 4 }),
    ),
  )
  render(<OnlineTable accountId="compte-test" />)
  fireEvent.click(screen.getByRole('button', { name: 'Créer une table' }))
  await screen.findByRole('region', { name: 'Ta main' })
  expect(screen.queryByRole('button', { name: /Esquiver avec/ })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Accepter le tir' })).toBeNull()
})

test('une réponse périmée affiche le refus puis le nouveau tir, sans rejouer la réponse', async () => {
  let view: GameView = {
    ...fourPlayerView(),
    currentSeat: 4,
    pendingShot: { id: 'ancien', shooterSeat: 4, targetSeat: 1 },
  }
  const fetch = vi.fn(async (url: string) => {
    if (url.endsWith('/state')) return Response.json(view)
    if (url.endsWith('/shots/ancien/accept')) {
      view = { ...view, pendingShot: { id: 'nouveau', shooterSeat: 4, targetSeat: 1 } }
      return Response.json({ error: 'Ce tir est déjà résolu.' }, { status: 409 })
    }
    return Response.json({ code: view.code, seat: 1, playerCount: 4 })
  })
  vi.stubGlobal('fetch', fetch)
  render(<OnlineTable accountId="compte-test" />)
  fireEvent.click(screen.getByRole('button', { name: 'Créer une table' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Accepter le tir' }))
  expect((await screen.findByRole('alert')).textContent).toBe('Ce tir est déjà résolu.')
  await waitFor(() => expect(fetch.mock.calls.filter(([url]) => url.endsWith('/state'))).toHaveLength(2))
  expect(fetch.mock.calls.filter(([url]) => url.includes('/shots/'))).toHaveLength(1)
  expect(within(screen.getByRole('region', { name: 'Tapis de la place 1' })).getByText('4/4 PV')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Accepter le tir' }))
  await waitFor(() =>
    expect(fetch).toHaveBeenCalledWith(
      '/api/games/bang/tables/ABC123/shots/nouveau/accept',
      expect.objectContaining({ method: 'POST' }),
    ),
  )
})

test('une ancienne lecture périodique ne réaffiche pas un tir déjà résolu', async () => {
  const pending: GameView = {
    ...fourPlayerView(),
    currentSeat: 4,
    pendingShot: { id: 'tir-courant', shooterSeat: 4, targetSeat: 1 },
  }
  const resolved = { ...pending, pendingShot: undefined }
  let finishOld!: (response: Response) => void
  const oldRead = new Promise<Response>((resolve) => {
    finishOld = resolve
  })
  let reads = 0
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url.endsWith('/state')) {
        reads++
        if (reads === 2) return oldRead
        return Response.json(reads === 1 ? pending : resolved)
      }
      if (url.endsWith('/accept')) return new Response(null, { status: 204 })
      return Response.json({ code: pending.code, seat: 1, playerCount: 4 })
    }),
  )
  vi.useFakeTimers()
  render(<OnlineTable accountId="compte-test" />)
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Créer une table' }))
  })
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2000)
  })
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Accepter le tir' }))
  })
  expect(screen.getByRole('status').textContent).toBe('Au tour de la place 4.')
  await act(async () => {
    finishOld(Response.json(pending))
  })
  expect(screen.getByRole('status').textContent).toBe('Au tour de la place 4.')
  expect(screen.queryByRole('button', { name: 'Accepter le tir' })).toBeNull()
})

test('actualiser la partie retrouve le même tir et sa place par une lecture, sans rejoindre ni démarrer', async () => {
  const view: GameView = {
    ...fourPlayerView(),
    currentSeat: 4,
    pendingShot: { id: 'conserve', shooterSeat: 4, targetSeat: 1 },
  }
  const fetch = vi.fn(async (url: string) =>
    Response.json(url.endsWith('/state') ? view : { code: view.code, seat: 1, playerCount: 4 }),
  )
  vi.stubGlobal('fetch', fetch)
  const first = render(<OnlineTable accountId="compte-test" />)
  fireEvent.click(screen.getByRole('button', { name: 'Créer une table' }))
  await screen.findByRole('button', { name: 'Accepter le tir' })
  first.unmount()
  fetch.mockClear()
  render(<OnlineTable accountId="compte-test" />)
  expect((await screen.findByRole('status')).textContent).toContain('La place 4 te vise')
  expect(fetch.mock.calls.map(([url]) => url)).toEqual(['/api/games/bang/tables/ABC123/state'])
})

test.each([401, 403, 404])(
  'une table mémorisée refusée en %i rend de nouveau la création et la jonction accessibles',
  async (status) => {
    sessionStorage.setItem('tiki:bang:table:compte-test', 'EXPIREE')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ error: 'Table indisponible.' }, { status })),
    )
    render(<OnlineTable accountId="compte-test" />)
    expect(await screen.findByRole('button', { name: 'Créer une table' })).toBeTruthy()
    expect(sessionStorage.getItem('tiki:bang:table:compte-test')).toBeNull()
    expect(screen.getByRole('alert').textContent).toBe('Table indisponible.')
  },
)

test('le code mémorisé est séparé pour chaque compte', () => {
  sessionStorage.setItem('tiki:bang:table:autre-compte', 'AUTRETABLE')
  const fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)
  render(<OnlineTable accountId="compte-test" />)
  expect(screen.getByRole('button', { name: 'Créer une table' })).toBeTruthy()
  expect(fetch).not.toHaveBeenCalled()
})

test('un stockage navigateur refusé ne bloque pas la partie en cours', async () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('Stockage refusé')
  })
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('Stockage refusé')
  })
  const view = fourPlayerView()
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) =>
      Response.json(url.endsWith('/state') ? view : { code: view.code, seat: 1, playerCount: 4 }),
    ),
  )
  render(<OnlineTable accountId="compte-test" />)
  fireEvent.click(screen.getByRole('button', { name: 'Créer une table' }))
  expect(await screen.findByRole('region', { name: 'Ta main' })).toBeTruthy()
})

test('une lecture lente actualise encore le plateau quand la lecture suivante est en vol', async () => {
  const pending: GameView = {
    ...fourPlayerView(),
    currentSeat: 4,
    pendingShot: { id: 'tir', shooterSeat: 4, targetSeat: 1 },
  }
  let finishSlow!: (response: Response) => void
  let finishNext!: (response: Response) => void
  const slow = new Promise<Response>((resolve) => {
    finishSlow = resolve
  })
  const next = new Promise<Response>((resolve) => {
    finishNext = resolve
  })
  let reads = 0
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url.endsWith('/state')) {
        reads++
        if (reads === 2) return slow
        if (reads === 3) return next
        return Response.json(pending)
      }
      return Response.json({ code: pending.code, seat: 1, playerCount: 4 })
    }),
  )
  vi.useFakeTimers()
  render(<OnlineTable accountId="compte-test" />)
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Créer une table' }))
  })
  await act(async () => {
    await vi.advanceTimersByTimeAsync(4000)
  })
  const resolved = { ...pending, pendingShot: undefined }
  await act(async () => {
    finishSlow(Response.json(resolved))
  })
  const hint = screen.getByRole('status').textContent
  await act(async () => {
    finishNext(Response.json(resolved))
  })
  expect(hint).toBe('Au tour de la place 4.')
})

test('un clic sur Finir le tour part après la vue PLAY même si la première lecture attend encore', async () => {
  const drawing: GameView = { ...fourPlayerView(), currentSeat: 1, phase: 'DRAW' }
  const playing: GameView = { ...drawing, phase: 'PLAY' }
  let finishSlow!: (response: Response) => void
  const slow = new Promise<Response>((resolve) => {
    finishSlow = resolve
  })
  let reads = 0
  const fetch = vi.fn(async (url: string) => {
    if (url.endsWith('/state')) {
      reads++
      if (reads === 2) return slow
      return Response.json(reads === 1 ? drawing : playing)
    }
    if (url.endsWith('/turn/draw') || url.endsWith('/turn/end')) return new Response(null, { status: 204 })
    return Response.json({ code: drawing.code, seat: 1, playerCount: 4 })
  })
  vi.stubGlobal('fetch', fetch)
  vi.useFakeTimers()
  render(<OnlineTable accountId="compte-test" />)
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Créer une table' }))
  })
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Piocher' }))
  })
  expect(reads).toBe(2)
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2000)
  })
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Finir le tour' }))
  })
  const sent = fetch.mock.calls.filter(([url]) => url.endsWith('/turn/end'))
  await act(async () => {
    finishSlow(Response.json(playing))
  })

  expect(sent).toHaveLength(1)
  expect(fetch).toHaveBeenCalledWith(
    '/api/games/bang/tables/ABC123/turn/end',
    expect.objectContaining({ method: 'POST' }),
  )
})

test('une ancienne lecture ne libère pas le POST suivant et ne remplace pas la vue du tour suivant', async () => {
  const drawing: GameView = { ...fourPlayerView(), currentSeat: 1, phase: 'DRAW' }
  const playing: GameView = { ...drawing, phase: 'PLAY' }
  const nextTurn: GameView = { ...drawing, currentSeat: 2 }
  let finishDrawRead!: (response: Response) => void
  let finishEndRead!: (response: Response) => void
  let finishEnd!: (response: Response) => void
  const drawRead = new Promise<Response>((resolve) => {
    finishDrawRead = resolve
  })
  const endRead = new Promise<Response>((resolve) => {
    finishEndRead = resolve
  })
  const end = new Promise<Response>((resolve) => {
    finishEnd = resolve
  })
  let reads = 0
  const fetch = vi.fn(async (url: string) => {
    if (url.endsWith('/state')) {
      reads++
      if (reads === 2) return drawRead
      if (reads === 4) return endRead
      return Response.json(reads === 1 ? drawing : reads === 3 ? playing : nextTurn)
    }
    if (url.endsWith('/turn/end')) return end
    if (url.endsWith('/turn/draw')) return new Response(null, { status: 204 })
    return Response.json({ code: drawing.code, seat: 1, playerCount: 4 })
  })
  vi.stubGlobal('fetch', fetch)
  vi.useFakeTimers()
  render(<OnlineTable accountId="compte-test" />)
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Créer une table' }))
  })
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Piocher' }))
  })
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2000)
  })
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Finir le tour' }))
  })
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2000)
  })
  expect(reads).toBe(4)
  await act(async () => {
    finishDrawRead(Response.json(playing))
  })
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Finir le tour' }))
  })
  const sent = fetch.mock.calls.filter(([url]) => url.endsWith('/turn/end'))
  await act(async () => {
    finishEnd(new Response(null, { status: 204 }))
  })
  expect(screen.getByRole('status').textContent).toBe('Au tour de la place 2.')
  await act(async () => {
    finishEndRead(Response.json(playing))
  })

  expect(sent).toHaveLength(1)
  expect(screen.getByRole('status').textContent).toBe('Au tour de la place 2.')
  expect(screen.queryByRole('button', { name: 'Finir le tour' })).toBeNull()
})

test.each([
  { cards: 4, clicks: 1, hint: 'Au tour de la place 2.' },
  { cards: 6, clicks: 1, hint: "Tu as trop de cartes : défausse-en jusqu'à 4." },
  { cards: 6, clicks: 2, hint: "Tu as trop de cartes : défausse-en jusqu'à 4." },
])(
  '$clicks clic(s) attendent la réponse de pioche puis finissent une seule fois avec $cards cartes',
  async ({ cards, clicks, hint }) => {
    const drawing: GameView = { ...fourPlayerView(), currentSeat: 1, phase: 'DRAW' }
    const playing: GameView = {
      ...drawing,
      phase: 'PLAY',
      hand: Array.from({ length: cards }, (_, index) => ({ id: `carte-${index}`, type: 'BANG' })),
    }
    let view = drawing
    let acknowledge!: (response: Response) => void
    const drawResponse = new Promise<Response>((resolve) => {
      acknowledge = resolve
    })
    const fetch = vi.fn(async (url: string) => {
      if (url.endsWith('/state')) return Response.json(view)
      if (url.endsWith('/turn/draw')) {
        view = playing
        return drawResponse
      }
      if (url.endsWith('/turn/end')) {
        view = { ...playing, phase: cards > 4 ? 'DISCARD' : 'DRAW', currentSeat: cards > 4 ? 1 : 2 }
        return new Response(null, { status: 204 })
      }
      return Response.json({ code: drawing.code, seat: 1, playerCount: 4 })
    })
    vi.stubGlobal('fetch', fetch)
    vi.useFakeTimers()
    render(<OnlineTable accountId="compte-test" />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Créer une table' }))
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Piocher' }))
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })
    for (let click = 0; click < clicks; click++) {
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Finir le tour' }))
      })
    }
    await act(async () => {
      acknowledge(new Response(null, { status: 204 }))
    })

    expect(fetch.mock.calls.filter(([url]) => url.endsWith('/turn/end'))).toHaveLength(1)
    expect(screen.getByRole('status').textContent).toBe(hint)
  },
)

test.each([1, 2])(
  '%i clic(s) après le 204 de pioche finissent une seule fois pendant la lecture suivante',
  async (clicks) => {
    const drawing: GameView = {
      ...fourPlayerView(),
      currentSeat: 1,
      phase: 'DRAW',
      role: 'SHERIFF',
      players: fourPlayerView().players.map((p) => ({
        ...p,
        role: p.seat === 1 ? 'SHERIFF' : undefined,
        ...(p.seat === 1 ? { health: 5, maxHealth: 5, handCount: 5 } : {}),
      })),
    }
    const playing: GameView = {
      ...drawing,
      phase: 'PLAY',
      hand: Array.from({ length: 7 }, (_, index) => ({ id: `carte-${index}`, type: 'BANG' })),
    }
    let view = drawing
    let acknowledge!: (response: Response) => void
    const drawResponse = new Promise<Response>((resolve) => {
      acknowledge = resolve
    })
    let releaseRead!: (response: Response) => void
    const readResponse = new Promise<Response>((resolve) => {
      releaseRead = resolve
    })
    let reads = 0
    const fetch = vi.fn(async (url: string) => {
      if (url.endsWith('/state')) {
        reads++
        return reads === 3 ? readResponse : Response.json(view)
      }
      if (url.endsWith('/turn/draw')) {
        view = playing
        return drawResponse
      }
      if (url.endsWith('/turn/end')) {
        view = { ...playing, phase: 'DISCARD' }
        return new Response(null, { status: 204 })
      }
      return Response.json({ code: drawing.code, seat: 1, playerCount: 4 })
    })
    vi.stubGlobal('fetch', fetch)
    vi.useFakeTimers()
    render(<OnlineTable accountId="compte-test" />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Créer une table' }))
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Piocher' }))
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })
    await act(async () => {
      acknowledge(new Response(null, { status: 204 }))
    })
    expect(reads).toBe(3)
    await act(async () => {
      for (let click = 0; click < clicks; click++)
        fireEvent.click(screen.getByRole('button', { name: 'Finir le tour' }))
    })
    await act(async () => {
      releaseRead(Response.json(playing))
    })

    expect(fetch.mock.calls.filter(([url]) => url.endsWith('/turn/end'))).toHaveLength(1)
    expect(screen.getByRole('status').textContent).toBe("Tu as trop de cartes : défausse-en jusqu'à 5.")
  },
)

test.each(['tour suivant', 'défausse', 'tir en attente', 'session perdue'])(
  'la fin de tour retenue avant le 204 est abandonnée après %s',
  async (change) => {
    const drawing: GameView = { ...fourPlayerView(), currentSeat: 1, phase: 'DRAW' }
    const playing: GameView = { ...drawing, phase: 'PLAY' }
    const changed: GameView =
      change === 'tour suivant'
        ? { ...drawing, currentSeat: 2 }
        : change === 'défausse'
          ? { ...playing, phase: 'DISCARD' }
          : { ...playing, pendingShot: { id: 'nouveau-tir', shooterSeat: 1, targetSeat: 2 } }
    let view = drawing
    let sessionLost = false
    let acknowledge!: (response: Response) => void
    const drawResponse = new Promise<Response>((resolve) => {
      acknowledge = resolve
    })
    const fetch = vi.fn(async (url: string) => {
      if (url.endsWith('/state'))
        return sessionLost ? Response.json({ error: 'Session perdue' }, { status: 401 }) : Response.json(view)
      if (url.endsWith('/turn/draw')) {
        view = playing
        return drawResponse
      }
      if (url.endsWith('/turn/end')) return new Response(null, { status: 204 })
      return Response.json({ code: drawing.code, seat: 1, playerCount: 4 })
    })
    vi.stubGlobal('fetch', fetch)
    vi.useFakeTimers()
    render(<OnlineTable accountId="compte-test" />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Créer une table' }))
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Piocher' }))
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Finir le tour' }))
    })
    view = changed
    sessionLost = change === 'session perdue'
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })
    await act(async () => {
      acknowledge(new Response(null, { status: 204 }))
    })

    expect(fetch.mock.calls.filter(([url]) => url.endsWith('/turn/end'))).toHaveLength(0)
    if (sessionLost) expect(screen.getByRole('button', { name: 'Créer une table' })).toBeTruthy()
    else
      expect(screen.getByRole('status').textContent).toBe(
        change === 'tour suivant'
          ? 'Au tour de la place 2.'
          : change === 'défausse'
            ? 'Tu as défaussé assez de cartes : finis ton tour.'
            : 'Tir de la place 1 vers la place 2 : en attente de sa réponse.',
      )
  },
)

test.each([1, 2])(
  '%i clic(s) restent valides quand la première lecture PLAY est livrée après le 204',
  async (clicks) => {
    const cards = Array.from({ length: 7 }, (_, index) => ({ id: `carte-${index}`, type: 'BANG' }))
    const drawing: GameView = {
      ...fourPlayerView(),
      currentSeat: 1,
      phase: 'DRAW',
      role: 'SHERIFF',
      hand: cards.slice(0, 5),
      players: fourPlayerView().players.map((p) => ({
        ...p,
        role: p.seat === 1 ? 'SHERIFF' : undefined,
        ...(p.seat === 1 ? { health: 5, maxHealth: 5, handCount: 5 } : {}),
      })),
    }
    const playing: GameView = {
      ...drawing,
      phase: 'PLAY',
      hand: cards,
      players: drawing.players.map((p) => (p.seat === 1 ? { ...p, handCount: 7 } : p)),
    }
    let view = drawing
    let acknowledge!: (response: Response) => void
    const drawResponse = new Promise<Response>((resolve) => {
      acknowledge = resolve
    })
    let deliverFirst!: (response: Response) => void
    const firstRead = new Promise<Response>((resolve) => {
      deliverFirst = resolve
    })
    let deliverSecond!: (response: Response) => void
    const secondRead = new Promise<Response>((resolve) => {
      deliverSecond = resolve
    })
    let reads = 0
    const fetch = vi.fn(async (url: string) => {
      if (url.endsWith('/state')) {
        reads++
        if (reads === 2) return firstRead
        if (reads === 3) return secondRead
        return Response.json(view)
      }
      if (url.endsWith('/turn/draw')) {
        view = playing
        return drawResponse
      }
      if (url.endsWith('/turn/end')) {
        view = { ...playing, phase: 'DISCARD' }
        return new Response(null, { status: 204 })
      }
      return Response.json({ code: drawing.code, seat: 1, playerCount: 4 })
    })
    vi.stubGlobal('fetch', fetch)
    vi.useFakeTimers()
    render(<OnlineTable accountId="compte-test" />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Créer une table' }))
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Piocher' }))
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })
    expect(reads).toBe(2)
    expect(screen.queryByRole('button', { name: 'Finir le tour' })).toBeNull()
    await act(async () => {
      acknowledge(new Response(null, { status: 204 }))
    })
    expect(reads).toBe(3)
    expect(screen.queryByRole('button', { name: 'Finir le tour' })).toBeNull()
    await act(async () => {
      deliverFirst(Response.json(playing))
    })
    const end = screen.getByRole('button', { name: 'Finir le tour' })
    expect(end.hasAttribute('disabled')).toBe(false)
    await act(async () => {
      for (let click = 0; click < clicks; click++) fireEvent.click(end)
    })
    await act(async () => {
      deliverSecond(Response.json(playing))
    })

    expect(fetch.mock.calls.filter(([url]) => url.endsWith('/turn/end'))).toHaveLength(1)
    expect(fetch).toHaveBeenCalledWith(
      '/api/games/bang/tables/ABC123/turn/end',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(screen.getByRole('status').textContent).toBe("Tu as trop de cartes : défausse-en jusqu'à 5.")
    expect(within(screen.getByRole('region', { name: 'Ta main' })).getAllByRole('listitem')).toHaveLength(7)
  },
)

test.each([false, true])(
  'le double clic reste unique avec une vue DISCARD déjà reçue=%s, puis la défausse autorise la fin suivante',
  async (freshBetweenClicks) => {
    const cards = Array.from({ length: 7 }, (_, index) => ({ id: `carte-${index}`, type: 'BANG' }))
    const drawing: GameView = {
      ...fourPlayerView(),
      currentSeat: 1,
      phase: 'DRAW',
      role: 'SHERIFF',
      hand: cards.slice(0, 5),
      players: fourPlayerView().players.map((p) => ({
        ...p,
        role: p.seat === 1 ? 'SHERIFF' : undefined,
        ...(p.seat === 1 ? { health: 5, maxHealth: 5, handCount: 5 } : {}),
      })),
    }
    const playing: GameView = {
      ...drawing,
      phase: 'PLAY',
      hand: cards,
      players: drawing.players.map((p) => (p.seat === 1 ? { ...p, handCount: 7 } : p)),
    }
    let view = drawing
    let acceptEnd!: (response: Response) => void
    const endResponse = new Promise<Response>((resolve) => {
      acceptEnd = resolve
    })
    let deliverStale!: (response: Response) => void
    const staleRead = new Promise<Response>((resolve) => {
      deliverStale = resolve
    })
    let deliverFresh!: (response: Response) => void
    const freshRead = new Promise<Response>((resolve) => {
      deliverFresh = resolve
    })
    let reads = 0
    let ends = 0
    const fetch = vi.fn(async (url: string) => {
      if (url.endsWith('/state')) {
        reads++
        if (reads === 3) return staleRead
        if (reads === 4) return freshRead
        return Response.json(view)
      }
      if (url.endsWith('/turn/draw')) {
        view = playing
        return new Response(null, { status: 204 })
      }
      if (url.endsWith('/turn/end')) {
        ends++
        if (ends === 1) return endResponse
        if (view.phase === 'DISCARD' && view.hand.length > 5)
          return Response.json({ error: 'Tu dois encore te défausser.' }, { status: 409 })
        view = { ...view, phase: 'DRAW', currentSeat: 2 }
        return new Response(null, { status: 204 })
      }
      if (url.includes('/turn/discard/')) {
        view = { ...view, hand: view.hand.filter((card) => !url.endsWith('/' + card.id)) }
        return new Response(null, { status: 204 })
      }
      return Response.json({ code: drawing.code, seat: 1, playerCount: 4 })
    })
    vi.stubGlobal('fetch', fetch)
    vi.useFakeTimers()
    render(<OnlineTable accountId="compte-test" />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Créer une table' }))
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Piocher' }))
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Finir le tour' }))
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })
    expect(reads).toBe(3)
    view = { ...playing, phase: 'DISCARD' }
    await act(async () => {
      acceptEnd(new Response(null, { status: 204 }))
    })
    expect(reads).toBe(4)
    await act(async () => {
      deliverStale(Response.json(playing))
    })
    if (freshBetweenClicks)
      await act(async () => {
        deliverFresh(Response.json(view))
      })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Finir le tour' }))
    })
    if (!freshBetweenClicks)
      await act(async () => {
        deliverFresh(Response.json(view))
      })

    expect(fetch.mock.calls.filter(([url]) => url.endsWith('/turn/end'))).toHaveLength(1)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByRole('status').textContent).toBe("Tu as trop de cartes : défausse-en jusqu'à 5.")
    for (let count = 7; count > 5; count--) {
      await act(async () => {
        fireEvent.click(
          within(screen.getByRole('region', { name: 'Ta main' })).getAllByRole('button', { name: 'BANG !' })[0],
        )
      })
      expect(within(screen.getByRole('region', { name: 'Ta main' })).getAllByRole('listitem')).toHaveLength(count - 1)
    }
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Finir le tour' }))
    })
    expect(fetch.mock.calls.filter(([url]) => url.endsWith('/turn/end'))).toHaveLength(2)
    expect(screen.getByRole('status').textContent).toBe('Au tour de la place 2.')
    expect(screen.queryByRole('alert')).toBeNull()
  },
)

test.each([0, 3])(
  'le premier clic défausse la carte %i déjà proposée avant le 204 de fin, sans attendre sa relecture',
  async (selectedIndex) => {
    const cards = Array.from({ length: 7 }, (_, index) => ({ id: `carte-${index}`, type: 'BANG' }))
    const drawing: GameView = {
      ...fourPlayerView(),
      currentSeat: 1,
      phase: 'DRAW',
      role: 'SHERIFF',
      hand: cards.slice(0, 5),
      players: fourPlayerView().players.map((p) => ({
        ...p,
        role: p.seat === 1 ? 'SHERIFF' : undefined,
        ...(p.seat === 1 ? { health: 5, maxHealth: 5, handCount: 5 } : {}),
      })),
    }
    const playing: GameView = {
      ...drawing,
      phase: 'PLAY',
      hand: cards,
      players: drawing.players.map((p) => (p.seat === 1 ? { ...p, handCount: 7 } : p)),
    }
    const discarding: GameView = { ...playing, phase: 'DISCARD' }
    let view = drawing
    let acknowledgeEnd!: (response: Response) => void
    const endResponse = new Promise<Response>((resolve) => {
      acknowledgeEnd = resolve
    })
    let deliverEndRead!: (response: Response) => void
    const endRead = new Promise<Response>((resolve) => {
      deliverEndRead = resolve
    })
    let reads = 0
    const fetch = vi.fn(async (url: string) => {
      if (url.endsWith('/state')) {
        reads++
        return reads === 4 ? endRead : Response.json(view)
      }
      if (url.endsWith('/turn/draw')) {
        view = playing
        return new Response(null, { status: 204 })
      }
      if (url.endsWith('/turn/end')) {
        view = discarding
        return endResponse
      }
      if (url.includes('/turn/discard/')) {
        const id = url.slice(url.lastIndexOf('/') + 1)
        view = {
          ...view,
          hand: view.hand.filter((card) => card.id !== id),
          players: view.players.map((p) => (p.seat === 1 ? { ...p, handCount: 6 } : p)),
        }
        return new Response(null, { status: 204 })
      }
      return Response.json({ code: drawing.code, seat: 1, playerCount: 4 })
    })
    vi.stubGlobal('fetch', fetch)
    vi.useFakeTimers()
    render(<OnlineTable accountId="compte-test" />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Créer une table' }))
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Piocher' }))
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Finir le tour' }))
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })
    expect(reads).toBe(3)
    expect(screen.getByRole('status').textContent).toBe("Tu as trop de cartes : défausse-en jusqu'à 5.")
    const hand = screen.getByRole('region', { name: 'Ta main' })
    expect(within(hand).getAllByRole('listitem')).toHaveLength(7)
    await act(async () => {
      acknowledgeEnd(new Response(null, { status: 204 }))
    })
    expect(reads).toBe(4)
    await act(async () => {
      fireEvent.click(within(hand).getAllByRole('button', { name: 'BANG !' })[selectedIndex])
    })
    await act(async () => {
      deliverEndRead(Response.json(discarding))
    })

    const chosenId = cards[selectedIndex].id
    const discards = fetch.mock.calls.filter(([url]) => url.includes('/turn/discard/'))
    expect(discards).toHaveLength(1)
    expect(discards[0]).toEqual([
      `/api/games/bang/tables/ABC123/turn/discard/${chosenId}`,
      expect.objectContaining({ method: 'POST' }),
    ])
    expect(view).toMatchObject({ currentSeat: 1, phase: 'DISCARD' })
    expect(view.hand).toEqual(cards.filter((card) => card.id !== chosenId))
    expect(within(screen.getByRole('region', { name: 'Ta main' })).getAllByRole('listitem')).toHaveLength(6)
    expect(screen.getByRole('status').textContent).toBe("Tu as trop de cartes : défausse-en jusqu'à 5.")
    expect(screen.queryByRole('alert')).toBeNull()
  },
)
