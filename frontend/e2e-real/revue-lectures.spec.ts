import { expect, test, type Page } from '@playwright/test'
import type { GameView } from '../src/games/bang/board/view'

async function login(page: Page, id: number) {
  await page.goto('/login')
  await page.getByLabel('Email', { exact: true }).fill('bang' + id + '@example.test')
  await page.getByLabel('Mot de passe', { exact: true }).fill('bang-browser-test-only')
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Salut bang_test_' + id + ' 👋' })).toBeVisible()
  await openFromCatalog(page)
  await expect(page.getByRole('button', { name: 'Créer une table' })).toBeVisible()
}

async function openFromCatalog(page: Page) {
  await page.goto('/?categorie=multi')
  await page.getByRole('link', { name: /^BANG !/ }).click()
  await expect(page).toHaveURL('/games/bang')
}

async function post(page: Page, path: string) {
  const token = (await page.context().cookies()).find((c) => c.name === 'XSRF-TOKEN')
  if (!token) throw Error('Le navigateur ne possède pas de jeton CSRF')
  return await page.request.post(path, { headers: { 'X-XSRF-TOKEN': decodeURIComponent(token.value) }, data: {} })
}

const tables = '/api/games/bang/tables'

async function state(page: Page, code: string): Promise<GameView> {
  const response = await page.request.get(`${tables}/${code}/state`)
  expect(response.status()).toBe(200)
  return response.json()
}

test('un clic reste valide quand un GET lancé avant le 204 affiche PLAY après le 204', async ({ browser }) => {
  const contexts = await Promise.all([1, 2, 3, 4].map(() => browser.newContext()))
  try {
    const pages = await Promise.all(contexts.map((ctx) => ctx.newPage()))
    await Promise.all(pages.map((p, index) => login(p, [5, 1, 2, 4][index])))
    const host = pages[0]
    const creating = host.waitForResponse((r) => r.url().endsWith(tables) && r.request().method() === 'POST')
    await host.getByRole('button', { name: 'Créer une table' }).click()
    const created = await creating
    expect(created.status()).toBe(201)
    const { code } = await created.json()
    const base = tables + '/' + code
    for (const friend of pages.slice(1)) expect((await post(friend, base + '/join')).status()).toBe(200)
    await host.getByRole('button', { name: 'Démarrer la partie' }).click()
    await expect(host.getByRole('button', { name: 'Piocher' })).toBeVisible()

    function gate() {
      let open!: () => void
      const promise = new Promise<void>((resolve) => {
        open = resolve
      })
      return { promise, open }
    }
    const drawOnServer = gate()
    const deliverDraw = gate()
    const firstRead = gate()
    const secondRead = gate()
    const deliverFirstRead = gate()
    const deliverOtherReads = gate()
    let posts = 0
    let playingReads = 0
    const events: string[] = []
    host.on('request', (req) => {
      if (req.url().endsWith('/turn/end') && req.method() === 'POST') {
        posts++
        events.push('POST /turn/end')
      }
    })
    try {
      await host.route('**/state', async (route) => {
        const resp = await route.fetch()
        if (resp.ok() && (await resp.json()).phase === 'PLAY') {
          playingReads++
          if (playingReads === 1) {
            events.push('Premier GET lancé avant le 204 et déjà calculé en PLAY')
            firstRead.open()
            await deliverFirstRead.promise
            events.push('Première lecture PLAY livrée au navigateur')
          } else {
            secondRead.open()
            await deliverOtherReads.promise
          }
        }
        await route.fulfill({ response: resp })
      })
      await host.route('**/turn/draw', async (route) => {
        const resp = await route.fetch()
        expect(resp.status()).toBe(204)
        drawOnServer.open()
        await deliverDraw.promise
        await route.fulfill({ response: resp })
      })
      await host.getByRole('button', { name: 'Piocher', exact: true }).click()
      await drawOnServer.promise
      await firstRead.promise
      const ack = host.waitForResponse((r) => r.request().method() === 'POST' && r.url().endsWith('/turn/draw'))
      deliverDraw.open()
      expect((await ack).status()).toBe(204)
      events.push('204 remis au navigateur alors que la première lecture est en vol')
      await secondRead.promise
      deliverFirstRead.open()
      const end = host.getByRole('button', { name: 'Finir le tour', exact: true })
      await expect(end).toBeVisible()
      await expect(end).toBeEnabled()
      expect(await state(host, code)).toMatchObject({ currentSeat: 1, phase: 'PLAY' })
      await expect(host.getByRole('region', { name: 'Ta main' }).getByRole('listitem')).toHaveCount(7)
      await end.click()
      events.push('Clic unique sur le bouton visible et actif, deuxième lecture encore en vol')
      deliverOtherReads.open()
      try {
        await expect
          .poll(async () => ({ posts, phase: (await state(host, code)).phase }), {
            timeout: 5500,
            message: 'Un seul clic doit envoyer une fois la commande et le serveur doit demander la défausse',
          })
          .toEqual({ posts: 1, phase: 'DISCARD' })
      } finally {
        const finalState = await state(host, code)
        const result = { events, posts, seat: finalState.currentSeat, phase: finalState.phase, playingReads }
        await test
          .info()
          .attach('ordre-et-etat', { body: JSON.stringify(result, null, 2), contentType: 'application/json' })
      }
    } finally {
      deliverDraw.open()
      deliverFirstRead.open()
      deliverOtherReads.open()
    }
  } finally {
    await Promise.all(contexts.map((ctx) => ctx.close()))
  }
})
