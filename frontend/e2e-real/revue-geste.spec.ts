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

test('un double clic garde une seule fin quand une lecture PLAY périmée arrive entre les clics', async ({
  browser,
}) => {
  const contexts = await Promise.all([1, 2, 3, 4].map(() => browser.newContext()))
  try {
    const pages = await Promise.all(contexts.map((ctx) => ctx.newPage()))
    await Promise.all(pages.map((p, index) => login(p, [6, 1, 2, 4][index])))
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
      const wait = new Promise<void>((res) => {
        open = res
      })
      return { open, wait }
    }
    const periodicDue = gate()
    await host.exposeFunction('reviewBangTickDue', periodicDue.open)
    // Le tick est réel. Seul son ordre par rapport au premier clic est contrôlé.
    // L'installer avant la navigation sur la table permet de différer exactement un callback.
    await host.addInitScript(() => {
      const w = window as unknown as Window & {
        reviewArmTick: () => void
        reviewReleaseTick: () => void
        reviewBangTickDue: () => Promise<void>
      }
      const original = w.setInterval.bind(w)
      let armed = false
      let held: (() => void) | null = null
      w.reviewArmTick = () => {
        armed = true
      }
      w.reviewReleaseTick = () => {
        const tick = held
        held = null
        tick?.()
      }
      w.setInterval = (handler: TimerHandler, ms?: number, ...args: unknown[]) => {
        if (ms !== 2000 || typeof handler !== 'function') return original(handler, ms, ...args)
        return original(() => {
          if (!armed) {
            handler(...args)
            return
          }
          armed = false
          held = () => handler(...args)
          void w.reviewBangTickDue()
        }, ms)
      }
    })
    await host.reload()
    const drawing = host.getByRole('button', { name: 'Piocher', exact: true })
    await expect(drawing).toBeVisible()
    await drawing.click()
    const finish = host.getByRole('button', { name: 'Finir le tour', exact: true })
    await expect(finish).toBeVisible()
    const hand = host.getByRole('region', { name: 'Ta main' }).getByRole('listitem')
    await expect(hand).toHaveCount(7)
    const metrics = {
      clicks: [] as { detail: number; time: number }[],
      events: [] as string[],
      posts: 0,
      codes: [] as number[],
    }
    await host.exposeFunction('reviewBangButtonClick', (detail: number) => {
      metrics.clicks.push({ detail, time: Date.now() })
      metrics.events.push('clic ' + detail)
    })
    await host.evaluate(() => {
      document.addEventListener(
        'click',
        (ev) => {
          if (ev.target instanceof HTMLElement && ev.target.textContent?.trim() === 'Finir le tour') {
            void (
              window as unknown as { reviewBangButtonClick: (detail: number) => Promise<void> }
            ).reviewBangButtonClick(ev.detail)
          }
        },
        true,
      )
    })
    const firstEnd = gate(),
      sendFirstEnd = gate(),
      staleSnapshot = gate(),
      deliverStale = gate(),
      staleWasSent = gate()
    const freshSnapshot = gate(),
      deliverFresh = gate()
    let staleCaptured = false
    try {
      await host.route('**/turn/end', async (route) => {
        metrics.posts++
        const nth = metrics.posts
        metrics.events.push('POST fin ' + nth)
        if (nth === 1) {
          firstEnd.open()
          await sendFirstEnd.wait
        }
        const reply = await route.fetch()
        metrics.codes.push(reply.status())
        metrics.events.push('HTTP fin ' + nth + ' = ' + reply.status())
        await route.fulfill({ response: reply })
      })
      await host.route('**/state', async (route) => {
        const reply = await route.fetch(),
          payload = await reply.json()
        if (metrics.posts >= 1 && payload.phase === 'PLAY' && !staleCaptured) {
          staleCaptured = true
          metrics.events.push('GET calculé en PLAY avant application de la fin')
          staleSnapshot.open()
          await deliverStale.wait
          await route.fulfill({ response: reply })
          metrics.events.push('GET PLAY livré après le 204 de fin')
          staleWasSent.open()
          return
        }
        if (metrics.posts >= 1 && payload.phase === 'DISCARD') {
          freshSnapshot.open()
          await deliverFresh.wait
        }
        await route.fulfill({ response: reply })
      })
      await host.evaluate(() => (window as unknown as { reviewArmTick: () => void }).reviewArmTick())
      await periodicDue.wait
      const firstAck = host.waitForResponse(
        (r) => r.request().method() === 'POST' && r.url().endsWith('/turn/end') && r.status() === 204,
      )
      const gesture = finish.dblclick({ delay: 180 })
      await firstEnd.wait
      await host.evaluate(() => (window as unknown as { reviewReleaseTick: () => void }).reviewReleaseTick())
      await staleSnapshot.wait
      sendFirstEnd.open()
      await firstAck
      await freshSnapshot.wait
      deliverStale.open()
      await staleWasSent.wait
      await gesture
      await expect.poll(() => metrics.clicks.map((c) => c.detail)).toEqual([1, 2])
      expect(metrics.events.indexOf('GET PLAY livré après le 204 de fin')).toBeGreaterThanOrEqual(0)
      expect(metrics.events.indexOf('GET PLAY livré après le 204 de fin')).toBeLessThan(
        metrics.events.indexOf('clic 2'),
      )
      deliverFresh.open()
      const authoritative = await state(host, code)
      expect(authoritative).toMatchObject({ currentSeat: 1, phase: 'DISCARD' })
      await expect(host.getByRole('status')).toContainText('défausse')
      if (metrics.posts === 2) await expect.poll(() => metrics.codes.length).toBe(2)
      const report = {
        ...metrics,
        clickIntervalMs: metrics.clicks[1].time - metrics.clicks[0].time,
        phase: authoritative.phase,
        seat: authoritative.currentSeat,
        alert: await host.getByRole('alert').allTextContents(),
      }
      await test
        .info()
        .attach('geste-et-commandes', { body: JSON.stringify(report, null, 2), contentType: 'application/json' })
      expect(metrics.posts, 'Un seul POST de fin pour le double clic').toBe(1)
      expect(metrics.codes).toEqual([204])
      expect(report.alert).toEqual([])
      const handRegion = host.getByRole('region', { name: 'Ta main' })
      for (let count = 7; count > 5; count--) {
        const discarding = host.waitForResponse(
          (r) => r.request().method() === 'POST' && r.url().includes('/turn/discard/'),
        )
        await handRegion.getByRole('button', { name: 'BANG !', exact: true }).first().click()
        expect((await discarding).status()).toBe(204)
        await expect(hand).toHaveCount(count - 1)
      }
      const passing = host.waitForResponse((r) => r.request().method() === 'POST' && r.url().endsWith('/turn/end'))
      await finish.click()
      expect((await passing).status()).toBe(204)
      const nextTurn = await state(host, code)
      expect(nextTurn).toMatchObject({ currentSeat: 2, phase: 'DRAW' })
      await expect(host.getByRole('status')).toHaveText('Au tour de la place 2.')
      await expect(host.getByRole('alert')).toHaveCount(0)
      expect(metrics.posts).toBe(2)
      expect(metrics.codes).toEqual([204, 204])
      await test.info().attach('fin-apres-defausse', {
        body: JSON.stringify({
          posts: metrics.posts,
          codes: metrics.codes,
          phase: nextTurn.phase,
          seat: nextTurn.currentSeat,
          handCount: nextTurn.hand.length,
        }),
        contentType: 'application/json',
      })
    } finally {
      sendFirstEnd.open()
      deliverStale.open()
      deliverFresh.open()
    }
  } finally {
    await Promise.all(contexts.map((c) => c.close()))
  }
})
