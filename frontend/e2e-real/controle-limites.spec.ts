import { expect, test, type Page } from '@playwright/test'
import type { GameView } from '../src/games/bang/board/view'
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

test('le clic entre la réponse à la pioche et la nouvelle lecture termine le tour', async ({ browser }) => {
  const contexts = await Promise.all([1, 2, 3, 4].map(() => browser.newContext()))
  let releaseRead!: () => void
  const readGate = new Promise<void>((resolve) => {
    releaseRead = resolve
  })
  let seenRead!: () => void
  const readStarted = new Promise<void>((resolve) => {
    seenRead = resolve
  })
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  try {
    const pages = await Promise.all(contexts.map((ctx) => ctx.newPage()))
    await Promise.all(pages.map((p, index) => login(p, [3, 1, 2, 4][index])))
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
    await host.route('**/state', async (route) => {
      const response = await route.fetch()
      seenRead()
      await readGate
      await route.fulfill({ response })
    })
    release()
    expect((await acknowledgement).status()).toBe(204)
    await readStarted
    await expect(end).toBeEnabled()
    await end.click()
    releaseRead()
    await expect
      .poll(() => endPosts, { message: 'Le clic déjà effectué doit émettre un POST de fin de tour', timeout: 4500 })
      .toBe(1)
    await expect(host.getByRole('status')).toHaveText("Tu as trop de cartes : défausse-en jusqu'à 5.")
    expect(await state(host, code)).toMatchObject({ currentSeat: 1, phase: 'DISCARD' })
    expect(endPosts).toBe(1)
  } finally {
    release()
    releaseRead()
    await Promise.all(contexts.map((ctx) => ctx.close()))
  }
})

test('un détour en ligne garde la partie sur le même écran', async ({ page }) => {
  const scorePosts: string[] = []
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().endsWith('/api/scores')) scorePosts.push(request.url())
  })
  await page.addInitScript(() => {
    Math.random = () => 0.85
  })
  await openGuest(page)
  const hand = page.getByRole('region', { name: 'Ta main' })
  await expect(hand.getByRole('listitem')).toHaveCount(5)
  const starting = await hand.getByRole('listitem').count()
  await page.getByRole('button', { name: 'Piocher', exact: true }).click()
  await expect(hand.getByRole('listitem')).toHaveCount(starting + 2)
  const cardsBefore = await hand.getByRole('listitem').allTextContents()
  const mats = page.getByRole('region', { name: /^Tapis de la place/ })
  const matsBefore = await mats.allTextContents()
  const phaseBefore = await page.getByRole('status').textContent()
  async function detour() {
    await page.getByRole('button', { name: 'En ligne', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Créer une table' })).toBeVisible()
    await expect(hand).toBeHidden()
    await page.getByRole('button', { name: 'Sur le même écran', exact: true }).click()
  }
  async function checkSheriff() {
    const sheriff = mats.filter({ has: page.getByText('Shérif', { exact: true }) })
    await expect(sheriff).toHaveCount(1)
    await expect(sheriff).toHaveAttribute('aria-label', 'Tapis de la place 1')
  }
  await detour()
  const cardsAfter = await hand.getByRole('listitem').allTextContents()
  await page.screenshot({ path: test.info().outputPath('retour-mode.png'), fullPage: true })
  expect(cardsAfter).toEqual(cardsBefore)
  expect(await mats.allTextContents()).toEqual(matsBefore)
  await expect(page.getByRole('status')).toHaveText(phaseBefore!)
  await expect(page.getByRole('button', { name: 'Finir le tour' })).toBeVisible()
  await checkSheriff()
  await hand.getByRole('button', { name: 'BANG !', exact: true }).first().click()
  await page.getByRole('button', { name: 'Viser la place 2' }).click()
  for (const seat of [2, 1]) {
    await detour()
    await expect(page.getByRole('status')).toHaveText(`Passe l'écran à la place ${seat}.`)
    await expect(hand).toHaveCount(0)
    await expect(page.getByText('Rôle privé', { exact: true })).toHaveCount(0)
    await checkSheriff()
    await page.screenshot({ path: test.info().outputPath(`passage-prive-${seat}.png`), fullPage: true })
    await page.getByRole('button', { name: `Afficher la main de la place ${seat}` }).click()
    if (seat === 2) await page.getByRole('button', { name: 'Esquiver avec Raté !' }).first().click()
  }
  await expect(hand.getByRole('listitem')).toHaveCount(6)
  await expect(page.getByRole('button', { name: 'Finir le tour' })).toBeVisible()
  expect(scorePosts).toEqual([])
  expect(
    await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith('tiki:pending-scores:'))),
  ).toEqual([])
})
