import { expect, test, type Page } from '@playwright/test'
import type { GameView } from '../src/games/bang/board/view'
import { compareLocalAndOnlineTurn } from './turn-parity'
import { loginAccount } from './session'

async function login(page: Page, id: number) {
  await loginAccount(page, id)
  await openFromCatalog(page)
  await expect(page.getByRole('button', { name: 'Créer une table' })).toBeVisible()
}

async function openGuest(page: Page) {
  await openFromCatalog(page)
  await expect(page.getByText(/Tu joues en invité/)).toBeVisible()
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

async function command(page: Page, path: string, click: () => Promise<void>) {
  const reply = page.waitForResponse((r) => r.url().endsWith(path) && r.request().method() === 'POST')
  await click()
  expect((await reply).status()).toBe(204)
}

async function checkSheriff(page: Page) {
  const sheriff = page.getByRole('region', { name: /^Tapis de la place/ }).filter({
    has: page.getByText('Shérif', { exact: true }),
  })
  await expect(sheriff).toHaveCount(1)
  await expect(sheriff).toHaveAttribute('aria-label', 'Tapis de la place 1')
}

function checkPrivateViews(views: GameView[]) {
  expect(views.map((v) => v.seat)).toEqual([1, 2, 3, 4])
  expect(views.map((v) => v.role)).toEqual(['SHERIFF', 'OUTLAW', 'OUTLAW', 'RENEGADE'])
  for (const view of views) {
    expect(view.players).toEqual(views[0].players)
    expect(Object.keys(view).sort()).toEqual(
      [
        'code',
        'seat',
        'currentSeat',
        'phase',
        'role',
        'hand',
        'players',
        ...(view.pendingShot ? ['pendingShot'] : []),
      ].sort(),
    )
    expect(view.players.filter((p) => p.role === 'SHERIFF').map((p) => p.seat)).toEqual([1])
    for (const player of view.players) {
      expect(Object.keys(player).sort()).toEqual(
        [
          'seat',
          'character',
          'health',
          'maxHealth',
          'playedCards',
          'handCount',
          ...(player.seat === 1 ? ['role'] : []),
        ].sort(),
      )
    }
    for (const other of views.filter((v) => v.seat !== view.seat)) {
      for (const card of other.hand) expect(JSON.stringify(view)).not.toContain(`"${card.id}"`)
    }
  }
}

async function finishOnlineTurn(page: Page, code: string) {
  const view = await state(page, code)
  const health = view.players.find((p) => p.seat === view.seat)!.health
  await command(page, '/turn/end', () => page.getByRole('button', { name: 'Finir le tour' }).click())
  if (view.hand.length > health) {
    await expect(page.getByRole('status')).toHaveText(`Tu as trop de cartes : défausse-en jusqu'à ${health}.`)
    const hand = page.getByRole('region', { name: 'Ta main' })
    for (let count = view.hand.length; count > health; count--) {
      const missed = hand.getByRole('button', { name: 'Raté !', exact: true })
      const useMissed = (await missed.count()) > 0
      const card = (await state(page, code)).hand.find((c) => c.type === (useMissed ? 'MISSED' : 'BANG'))!
      const button = useMissed ? missed : hand.getByRole('button', { name: 'BANG !', exact: true })
      await command(page, '/turn/discard/' + card.id, () => button.first().click())
      await expect(hand.getByRole('listitem')).toHaveCount(count - 1)
    }
    await command(page, '/turn/end', () => page.getByRole('button', { name: 'Finir le tour' }).click())
  }
  await expect(page.getByRole('status')).toHaveText(`Au tour de la place ${(view.seat % 4) + 1}.`)
}

async function finishLocalTurn(page: Page) {
  await page.getByRole('button', { name: 'Finir le tour' }).click()
  while ((await page.getByRole('status').textContent())?.startsWith('Tu as trop de cartes')) {
    const hand = page.getByRole('region', { name: 'Ta main' })
    const missed = hand.getByRole('button', { name: 'Raté !', exact: true })
    await ((await missed.count()) ? missed : hand.getByRole('button', { name: 'BANG !', exact: true })).first().click()
  }
  if (await page.getByRole('button', { name: 'Finir le tour' }).count()) {
    await page.getByRole('button', { name: 'Finir le tour' }).click()
  }
}

test('sur un écran, le BANG! atteint un voisin à portée', async ({ page, browser, baseURL }) => {
  await test.step('même tour local et en ligne', () => compareLocalAndOnlineTurn(browser, baseURL!))
  await page.addInitScript(() => {
    Math.random = () => 0.85
  })
  await openGuest(page)
  await checkSheriff(page)
  await page.screenshot({ path: test.info().outputPath('place-locale-1.png'), fullPage: true })
  await page.getByRole('button', { name: 'Piocher', exact: true }).click()
  const hand = page.getByRole('region', { name: 'Ta main' })
  const before = await hand.getByRole('listitem').count()
  await hand.getByRole('button', { name: 'BANG !', exact: true }).first().click()
  await page.getByRole('button', { name: 'Viser la place 2', exact: true }).click()
  expect(before).toBe(7)
  await expect(page.getByRole('region', { name: 'Tapis de la place 1' }).getByText('6 en main')).toBeVisible()
  await expect(hand).toHaveCount(0)
  await expect(page.getByText('Rôle privé', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Afficher la main de la place 2' })).toBeVisible()
  await page.getByRole('button', { name: 'Afficher la main de la place 2' }).click()
  await checkSheriff(page)
  await page.screenshot({ path: test.info().outputPath('place-locale-2.png'), fullPage: true })
  await page.getByRole('button', { name: 'Esquiver avec Raté !' }).first().click()
  await expect(page.getByRole('region', { name: 'Tapis de la place 2' }).getByText('3 en main')).toBeVisible()
  await expect(page.getByRole('region', { name: 'Tapis de la place 2' }).getByText('4/4 PV')).toBeVisible()
  await expect(hand).toHaveCount(0)
  await page.getByRole('button', { name: 'Afficher la main de la place 1' }).click()
  await expect(hand.getByRole('listitem')).toHaveCount(6)
  await expect(page.getByRole('button', { name: 'Finir le tour' })).toBeVisible()
  await hand.getByRole('button', { name: 'BANG !', exact: true }).first().click()
  await page.getByRole('button', { name: 'Viser la place 2' }).click()
  await expect(page.getByRole('alert')).toHaveText('Un seul BANG ! par tour.')
  await expect(hand.getByRole('listitem')).toHaveCount(6)
  await expect(page.getByRole('button', { name: 'Afficher la main de la place 2' })).toHaveCount(0)
  await finishLocalTurn(page)
  await page.getByRole('button', { name: 'Afficher la main de la place 2' }).click()
  await page.getByRole('button', { name: 'Piocher' }).click()
  await hand.getByRole('button', { name: 'BANG !', exact: true }).first().click()
  await page.getByRole('button', { name: 'Viser la place 1' }).click()
  await page.getByRole('button', { name: 'Afficher la main de la place 1' }).click()
  await expect(page.getByRole('button', { name: 'Accepter le tir' })).toBeVisible()
  await page.getByRole('button', { name: 'Accepter le tir' }).click()
  await expect(page.getByRole('region', { name: 'Tapis de la place 1' }).getByText('4/5 PV')).toBeVisible()
  await expect(page.getByRole('region', { name: 'Tapis de la place 1' }).getByText('6 en main')).toBeVisible()
  await page.getByRole('button', { name: 'Afficher la main de la place 2' }).click()
  await finishLocalTurn(page)
  for (const seat of [3, 4]) {
    await page.getByRole('button', { name: `Afficher la main de la place ${seat}` }).click()
    await checkSheriff(page)
    await page.screenshot({ path: test.info().outputPath(`place-locale-${seat}.png`), fullPage: true })
    await page.getByRole('button', { name: 'Piocher' }).click()
    await finishLocalTurn(page)
  }
  await page.getByRole('button', { name: 'Afficher la main de la place 1' }).click()
  await page.getByRole('button', { name: 'Piocher' }).click()
  await hand.getByRole('button', { name: 'BANG !', exact: true }).first().click()
  await page.getByRole('button', { name: 'Viser la place 2' }).click()
  await page.getByRole('button', { name: 'Afficher la main de la place 2' }).click()
  await page.getByRole('button', { name: 'Accepter le tir' }).click()
  await expect(page.getByRole('region', { name: 'Tapis de la place 2' }).getByText('3/4 PV')).toBeVisible()
  await page.getByRole('button', { name: 'Afficher la main de la place 1' }).click()
  await page.screenshot({ path: test.info().outputPath('tir-local.png') })
})

test('deux invités rejoignent, tirent et reprennent leurs sièges auprès de deux comptes', async ({ browser }) => {
  const contexts = await Promise.all([1, 2, 3, 4].map(() => browser.newContext()))
  try {
    const [host, friend, ...guests] = await Promise.all(contexts.map((ctx) => ctx.newPage()))
    const guestScorePosts: string[] = []
    for (const guest of guests)
      guest.on('request', (request) => {
        if (request.method() === 'POST' && request.url().endsWith('/api/scores')) guestScorePosts.push(request.url())
      })
    await Promise.all([login(host, 4), login(friend, 3), ...guests.map(openGuest)])
    for (const guest of guests) {
      await expect(guest.getByRole('button', { name: 'En ligne', exact: true })).toBeVisible()
      await guest.getByRole('button', { name: 'En ligne', exact: true }).click()
    }
    const creating = host.waitForResponse((r) => r.url().endsWith(tables) && r.request().method() === 'POST')
    await host.getByRole('button', { name: 'Créer une table' }).click()
    const created = await creating
    expect(created.status()).toBe(201)
    const { code } = await created.json()
    const path = tables + '/' + code + '/join'
    const responses = []
    for (const player of [friend, ...guests]) {
      const joining = player.waitForResponse(
        (r) => new URL(r.url()).pathname === path && r.request().method() === 'POST',
      )
      await player.getByLabel('Code de la table').fill(code)
      await player.getByRole('button', { name: 'Rejoindre', exact: true }).click()
      const response = await joining
      if (player === friend) expect(response.status()).toBe(200)
      else responses.push(response)
    }
    const statuses = responses.map((res) => res.status())
    expect(statuses).toEqual([200, 200])
    const seats = await Promise.all(responses.map((res) => res.json()))
    expect(seats.map((s) => s.seat)).toEqual([3, 4])
    const pages = [host, friend, ...guests]
    const sessions = await Promise.all(
      contexts.map(async (context) => (await context.cookies()).find((cookie) => cookie.name === 'JSESSIONID')!.value),
    )
    expect(new Set(sessions).size).toBe(4)
    await host.getByRole('button', { name: 'Démarrer la partie' }).click()
    for (const player of pages) await expect(player.getByRole('region', { name: 'Ta main' })).toBeVisible()
    checkPrivateViews(await Promise.all(pages.map((p) => state(p, code))))
    for (const player of pages) await checkSheriff(player)

    for (const account of [host, friend]) {
      await command(account, '/turn/draw', () => account.getByRole('button', { name: 'Piocher' }).click())
      await expect(account.getByRole('button', { name: 'Finir le tour' })).toBeVisible()
      await finishOnlineTurn(account, code)
    }
    const [janet, paul] = guests
    await command(janet, '/turn/draw', () => janet.getByRole('button', { name: 'Piocher' }).click())
    await expect(janet.getByRole('button', { name: 'Finir le tour' })).toBeVisible()
    await janet
      .getByRole('region', { name: 'Ta main' })
      .getByRole('button', { name: 'BANG !', exact: true })
      .first()
      .click()
    await command(janet, '/targets/2', () => janet.getByRole('button', { name: 'Viser la place 2' }).click())
    await expect(friend.getByRole('button', { name: 'Accepter le tir' })).toBeVisible()
    const bartBefore = await state(friend, code)
    await command(friend, '/accept', () => friend.getByRole('button', { name: 'Accepter le tir' }).click())
    const bartAfter = await state(friend, code)
    expect(bartAfter.players[1].health).toBe(bartBefore.players[1].health - 1)
    expect(bartAfter.hand).toHaveLength(bartBefore.hand.length + 1)
    await expect(janet.getByRole('button', { name: 'Finir le tour' })).toBeVisible()
    await finishOnlineTurn(janet, code)

    await command(paul, '/turn/draw', () => paul.getByRole('button', { name: 'Piocher' }).click())
    await expect(paul.getByRole('button', { name: 'Finir le tour' })).toBeVisible()
    await paul
      .getByRole('region', { name: 'Ta main' })
      .getByRole('button', { name: 'BANG !', exact: true })
      .first()
      .click()
    await command(paul, '/targets/3', () => paul.getByRole('button', { name: 'Viser la place 3' }).click())
    const pending = await state(janet, code)
    expect(pending.pendingShot).toMatchObject({ shooterSeat: 4, targetSeat: 3 })
    await janet.reload()
    await expect(janet.getByRole('button', { name: 'Esquiver avec Raté !' }).first()).toBeVisible()
    expect(await state(janet, code)).toEqual(pending)

    const paulBefore = await state(paul, code)
    await paul.context().setOffline(true)
    expect(
      await paul.evaluate(async () => {
        try {
          await fetch('/api/auth/session')
          return true
        } catch {
          return false
        }
      }),
    ).toBe(false)
    await paul.context().setOffline(false)
    await paul.reload()
    await expect(paul.getByRole('status')).toHaveText('Tir de la place 4 vers la place 3 : en attente de sa réponse.')
    expect(await state(paul, code)).toEqual(paulBefore)
    await command(janet, '/dodge/' + pending.hand.find((c) => c.type === 'MISSED')!.id, () =>
      janet.getByRole('button', { name: 'Esquiver avec Raté !' }).first().click(),
    )
    const dodged = await state(janet, code)
    expect(dodged.hand).toHaveLength(pending.hand.length - 1)
    expect(dodged.players[2].health).toBe(pending.players[2].health)
    expect(dodged.currentSeat).toBe(4)
    expect(dodged.phase).toBe('PLAY')
    await finishOnlineTurn(paul, code)
    for (const guest of guests) {
      expect(await (await guest.request.get('/api/auth/session')).json()).toEqual({ user: null })
      expect(
        await guest.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith('tiki:pending-scores:'))),
      ).toEqual([])
    }
    expect(guestScorePosts).toEqual([])
    const finalViews = await Promise.all(pages.map((p) => state(p, code)))
    for (const view of finalViews) {
      expect(view.currentSeat).toBe(1)
      expect(view.phase).toBe('DRAW')
      expect(view.pendingShot).toBeUndefined()
    }
    checkPrivateViews(finalViews)
    await test.info().attach('roles-et-sieges-mixtes', {
      body: JSON.stringify(finalViews.map(({ seat, role }) => ({ seat, role }))),
      contentType: 'application/json',
    })
    for (const [index, player] of pages.entries()) {
      await checkSheriff(player)
      await player.screenshot({ path: test.info().outputPath(`place-mixte-${index + 1}.png`), fullPage: true })
    }
  } finally {
    await Promise.all(contexts.map((ctx) => ctx.close()))
  }
})

test('un seul clic sur Finir le tour est transmis quand la réponse du POST de pioche tarde', async ({ browser }) => {
  const contexts = await Promise.all([1, 2, 3, 4].map(() => browser.newContext()))
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  try {
    const pages = await Promise.all(contexts.map((ctx) => ctx.newPage()))
    await Promise.all(pages.map((p, index) => login(p, [2, 1, 3, 4][index])))
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
    let endPosts = 0
    let drawApplied!: () => void
    const realDraw = new Promise<void>((resolve) => {
      drawApplied = resolve
    })
    host.on('request', (req) => {
      if (req.url().endsWith('/turn/end') && req.method() === 'POST') endPosts++
    })
    await host.route('**/turn/draw', async (route) => {
      const response = await route.fetch()
      if (response.status() !== 204) throw Error('Échec de pioche sur le vrai serveur: ' + response.status())
      drawApplied()
      await gate
      await route.fulfill({ response })
    })
    await host.getByRole('button', { name: 'Piocher' }).click()
    await realDraw
    const end = host.getByRole('button', { name: 'Finir le tour' })
    await expect(end).toBeEnabled()
    expect((await (await host.request.get(base + '/state')).json()).phase).toBe('PLAY')
    const acknowledgement = host.waitForResponse(
      (r) => r.url().endsWith('/turn/draw') && r.request().method() === 'POST',
    )
    await end.click()
    release()
    expect((await acknowledgement).status()).toBe(204)
    await expect
      .poll(() => endPosts, { message: 'Le clic déjà effectué doit émettre un POST de fin de tour', timeout: 4500 })
      .toBe(1)
    await expect(host.getByRole('status')).toHaveText("Tu as trop de cartes : défausse-en jusqu'à 5.")
    expect(await state(host, code)).toMatchObject({ currentSeat: 1, phase: 'DISCARD' })
    expect(endPosts).toBe(1)
  } finally {
    release()
    await Promise.all(contexts.map((ctx) => ctx.close()))
  }
})
