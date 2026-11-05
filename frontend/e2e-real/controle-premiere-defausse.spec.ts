import { expect, test, type Page } from '@playwright/test'
import type { GameView } from '../src/games/bang/board/view'
import { loginAccount } from './session'

async function login(page: Page, id: number) {
  await loginAccount(page, id)
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

test('le premier clic sur une carte visible en défausse vaut même si la relecture de fin de tour attend', async ({
  browser,
}) => {
  const contexts = await Promise.all([1, 2, 3, 4].map(() => browser.newContext()))
  try {
    const pages = await Promise.all(contexts.map((ctx) => ctx.newPage()))
    await Promise.all(pages.map((p, index) => login(p, [7, 1, 2, 4][index])))
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

    const deferred = () => {
      let open!: () => void
      const wait = new Promise<void>((resolve) => {
        open = resolve
      })
      return { wait, open }
    }
    const finishAccepted = deferred(),
      deliverFinish = deferred(),
      nextRead = deferred(),
      deliverReads = deferred()
    const events: string[] = []
    const discardPaths: string[] = []
    let discards = 0
    let ends = 0
    const responseCodes: number[] = []
    try {
      const hand = host.getByRole('region', { name: 'Ta main' })
      await host.getByRole('button', { name: 'Piocher', exact: true }).click()
      await expect(hand.getByRole('listitem')).toHaveCount(7)
      const finish = host.getByRole('button', { name: 'Finir le tour', exact: true })
      await expect(finish).toBeEnabled()
      await host.route('**/turn/end', async (route) => {
        ends++
        const response = await route.fetch()
        expect(response.status()).toBe(204)
        events.push('Spring accepte la fin de tour')
        finishAccepted.open()
        await deliverFinish.wait
        await route.fulfill({ response })
      })
      host.on('request', (req) => {
        if (req.method() === 'POST' && req.url().includes('/turn/discard/')) {
          discards++
          discardPaths.push(new URL(req.url()).pathname)
          events.push('POST de défausse')
        }
      })
      host.on('response', (r) => {
        if (r.request().method() === 'POST' && r.url().includes('/turn/discard/')) responseCodes.push(r.status())
      })
      await finish.click()
      await finishAccepted.wait
      await expect(host.getByRole('status')).toContainText('défausse')
      const card = hand.getByRole('button').first()
      await expect(card).toBeVisible()
      await expect(card).toBeEnabled()
      const before = await state(host, code)
      expect(before).toMatchObject({ phase: 'DISCARD', currentSeat: 1 })
      expect(before.hand).toHaveLength(7)
      const chosen = before.hand[0]
      events.push('Le plateau propose déjà les cartes à défausser')
      await host.route('**/state', async (route) => {
        const response = await route.fetch()
        nextRead.open()
        await deliverReads.wait
        await route.fulfill({ response })
      })
      const ack = host.waitForResponse((r) => r.request().method() === 'POST' && r.url().endsWith('/turn/end'))
      deliverFinish.open()
      expect((await ack).status()).toBe(204)
      events.push('204 fin reçu au navigateur')
      await nextRead.wait
      await expect(card).toBeEnabled()
      const discardResponse = host.waitForResponse(
        (r) =>
          r.request().method() === 'POST' &&
          new URL(r.url()).pathname === `${base}/turn/discard/${encodeURIComponent(chosen.id)}`,
      )
      await card.click()
      events.push('Clic unique sur la première carte alors que la relecture est en vol')
      deliverReads.open()
      try {
        expect((await discardResponse).status()).toBe(204)
        await expect
          .poll(
            async () => {
              const latest = await state(host, code)
              return {
                discards,
                cards: latest.hand.length,
                chosenStillHeld: latest.hand.some((c) => c.id === chosen.id),
              }
            },
            { timeout: 5500, message: 'Le seul clic doit défausser cette carte' },
          )
          .toEqual({ discards: 1, cards: 6, chosenStillHeld: false })
        expect(discardPaths).toEqual([`${base}/turn/discard/${encodeURIComponent(chosen.id)}`])
        expect(responseCodes).toEqual([204])
        expect(ends).toBe(1)
        expect(await state(host, code)).toMatchObject({ currentSeat: 1, phase: 'DISCARD' })
        await expect(hand.getByRole('listitem')).toHaveCount(6)
        await expect(host.getByRole('alert')).toHaveCount(0)
      } finally {
        const server = await state(host, code)
        const final = {
          events,
          discards,
          discardPaths,
          responseCodes,
          ends,
          chosenId: chosen.id,
          cardsBefore: before.hand.length,
          cardsAfter: server.hand.length,
          chosenStillHeld: server.hand.some((c) => c.id === chosen.id),
          seat: server.currentSeat,
          phase: server.phase,
          alert: await host.getByRole('alert').allTextContents(),
        }
        await test
          .info()
          .attach('premiere-defausse', { body: JSON.stringify(final, null, 2), contentType: 'application/json' })
      }
      const secondCard = (await state(host, code)).hand[0]
      const secondDiscard = host.waitForResponse(
        (r) =>
          r.request().method() === 'POST' &&
          new URL(r.url()).pathname === `${base}/turn/discard/${encodeURIComponent(secondCard.id)}`,
      )
      await hand.getByRole('button').first().click()
      expect((await secondDiscard).status()).toBe(204)
      await expect(hand.getByRole('listitem')).toHaveCount(5)
      const afterDiscards = await state(host, code)
      expect(afterDiscards).toMatchObject({ currentSeat: 1, phase: 'DISCARD' })
      expect(afterDiscards.hand).toHaveLength(5)
      expect(afterDiscards.hand.map((c) => c.id)).not.toContain(secondCard.id)
      expect(afterDiscards.hand.map((c) => c.id)).not.toContain(chosen.id)
      expect(discardPaths).toEqual([chosen, secondCard].map((c) => `${base}/turn/discard/${encodeURIComponent(c.id)}`))
      expect(responseCodes).toEqual([204, 204])
      const passing = host.waitForResponse((r) => r.request().method() === 'POST' && r.url().endsWith('/turn/end'))
      await finish.click()
      expect((await passing).status()).toBe(204)
      const nextTurn = await state(host, code)
      expect(nextTurn).toMatchObject({ currentSeat: 2, phase: 'DRAW' })
      await expect(host.getByRole('status')).toHaveText('Au tour de la place 2.')
      await expect(host.getByRole('alert')).toHaveCount(0)
      expect(discards).toBe(2)
      expect(ends).toBe(2)
      await test.info().attach('suite-apres-defausse', {
        body: JSON.stringify({
          discards,
          discardPaths,
          responseCodes,
          ends,
          seat: nextTurn.currentSeat,
          phase: nextTurn.phase,
          handCount: nextTurn.hand.length,
        }),
        contentType: 'application/json',
      })
    } finally {
      deliverFinish.open()
      deliverReads.open()
    }
  } finally {
    await Promise.all(contexts.map((ctx) => ctx.close()))
  }
})
