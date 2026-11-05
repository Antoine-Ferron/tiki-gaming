import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { INITIAL, MOVE, NEXT } from '../src/games/dame/test-fixtures'
import type { DameView } from '../src/games/dame/types'
import { mockPlatform } from './fixtures'

type Call = { method: string; body: unknown; csrf?: string }
const square = (page: Page, name: string) => page.getByRole('button', { name: new RegExp(`^${name},`) })

/** Réponses scriptées du serveur, comme le socle E2E ; aucune règle Java n'est reproduite ici. */
async function mockDame(page: Page, options: { initial?: DameView; next?: DameView; lostReply?: boolean } = {}) {
  const calls: Call[] = []
  let current: DameView | null = null
  let lostReply = options.lostReply ?? false
  await page.route('**/api/games/dame/**', async (route) => {
    const request = route.request()
    const method = request.method()
    const path = new URL(request.url()).pathname
    const body = request.postDataJSON()
    calls.push({ method, body, csrf: request.headers()['x-xsrf-token'] })
    if (method === 'POST' && path === '/api/games/dame/matches') {
      current = { ...(options.initial ?? INITIAL), ...body }
      return route.fulfill({ status: 201, json: current })
    }
    if (!current) return route.fulfill({ status: 404, json: { error: 'Rencontre introuvable.' } })
    if (method === 'GET') return route.fulfill({ json: current })
    if (method === 'POST' && path.endsWith('/moves')) {
      current = { ...(options.next ?? NEXT), whiteName: current.whiteName, blackName: current.blackName }
      if (lostReply) {
        lostReply = false
        return route.abort('connectionreset')
      }
      return route.fulfill({ json: current })
    }
    return route.abort()
  })
  return calls
}

async function start(page: Page) {
  await page.getByRole('textbox', { name: 'Joueur blanc', exact: true }).fill(' Chérif ')
  await page.getByRole('textbox', { name: 'Joueur noir', exact: true }).fill('Amadou')
  await page.getByRole('button', { name: 'Commencer la partie' }).click()
  await expect(page.getByText('Chérif · Blancs à jouer', { exact: true })).toBeVisible()
}

test.beforeEach(async ({ page, baseURL }) => {
  await mockPlatform(page)
  await page.context().addCookies([{ name: 'XSRF-TOKEN', value: 'csrf-dame-e2e', url: baseURL! }])
})

test('Dames : lobby, noms, coup au clavier puis reprise sans nouvelle création', async ({ page }) => {
  const calls = await mockDame(page)
  await page.goto('/')
  await page.getByRole('link', { name: /Dames internationales/ }).click()
  await start(page)
  await expect(
    page.getByRole('group', { name: 'Damier de dix lignes et dix colonnes' }).getByRole('button'),
  ).toHaveCount(100)

  await square(page, 'B4').focus()
  await page.keyboard.press('Enter')
  await expect(square(page, 'A5')).toHaveAccessibleName(/arrivée possible/)
  await page.keyboard.press('ArrowUp')
  await page.keyboard.press('ArrowLeft')
  await expect(square(page, 'A5')).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByText('Amadou · Noirs à jouer', { exact: true })).toBeVisible()
  await expect(square(page, 'A5')).toHaveAccessibleName(/pion blanc/)

  const commands = calls.filter((call) => call.method === 'POST')
  expect(commands).toEqual([
    { method: 'POST', body: { whiteName: 'Chérif', blackName: 'Amadou' }, csrf: 'csrf-dame-e2e' },
    { method: 'POST', body: { version: 0, ...MOVE }, csrf: 'csrf-dame-e2e' },
  ])
  await page.reload()
  await expect(page.getByText('Amadou · Noirs à jouer', { exact: true })).toBeVisible()
  expect(calls.filter((call) => call.method === 'POST')).toHaveLength(2)
  expect(calls.filter((call) => call.method === 'GET')).toHaveLength(1)
})

test('Dames : les noms invalides sont expliqués sans création', async ({ page }) => {
  const calls = await mockDame(page)
  await page.goto('/games/dame')
  await page.getByRole('button', { name: 'Commencer la partie' }).click()
  await expect(page.getByRole('alert')).toHaveCount(2)
  await page.getByRole('textbox', { name: 'Joueur blanc', exact: true }).fill('a'.repeat(51))
  await page.getByRole('textbox', { name: 'Joueur noir', exact: true }).fill('Amadou')
  await page.getByRole('button', { name: 'Commencer la partie' }).click()
  await expect(page.getByText('50 caractères maximum.')).toBeVisible()
  expect(calls).toHaveLength(0)
})

test('Dames : une réponse perdue se récupère par GET sans rejouer le coup', async ({ page }) => {
  const calls = await mockDame(page, { lostReply: true })
  await page.goto('/games/dame')
  await start(page)
  await square(page, 'B4').click()
  await square(page, 'A5').click()
  await expect(page.getByRole('alert')).toContainText('Le serveur est injoignable.')
  await expect(square(page, 'B4')).toHaveAccessibleName(/pion blanc/)
  await expect(square(page, 'B4')).toBeDisabled()
  await page.getByRole('button', { name: 'Actualiser la partie' }).click()
  await expect(page.getByText('Amadou · Noirs à jouer', { exact: true })).toBeVisible()
  expect(calls.filter((call) => call.method === 'POST')).toHaveLength(2)
  expect(calls.filter((call) => call.method === 'GET')).toHaveLength(1)
})

test('Dames : une rafle complète mène au résultat du serveur puis au formulaire de revanche', async ({ page }) => {
  const capture = {
    from: MOVE.from,
    landings: [
      { row: 4, column: 3 },
      { row: 2, column: 5 },
    ],
  }
  const initial: DameView = {
    ...INITIAL,
    board: {
      rows: 10,
      columns: 10,
      pieces: [
        { row: 6, column: 1, owner: 'WHITE', king: false },
        { row: 5, column: 2, owner: 'BLACK', king: false },
        { row: 3, column: 4, owner: 'BLACK', king: true },
      ],
    },
    legalMoves: [capture],
  }
  const next: DameView = {
    ...NEXT,
    status: 'WHITE_WON',
    winner: 'WHITE',
    legalMoves: [],
    board: { rows: 10, columns: 10, pieces: [{ row: 2, column: 5, owner: 'WHITE', king: false }] },
    finishedAt: '2026-11-05T12:01:00Z',
  }
  const calls = await mockDame(page, { initial, next })
  await page.goto('/games/dame')
  await start(page)
  await square(page, 'B4').click()
  await square(page, 'D6').click()
  await expect(square(page, 'F8')).toHaveAccessibleName(/arrivée possible/)
  expect(calls.filter((call) => call.method === 'POST')).toHaveLength(1)
  await square(page, 'F8').click()
  await expect(page.getByText('Chérif remporte la partie !', { exact: true })).toBeVisible()
  expect(calls.filter((call) => call.method === 'POST')[1].body).toEqual({ version: 0, ...capture })
  await page.getByRole('button', { name: 'Rejouer' }).click()
  await expect(page.getByRole('textbox', { name: 'Joueur blanc', exact: true })).toHaveValue('Chérif')
  expect(calls.filter((call) => call.method === 'POST')).toHaveLength(2)
})

test('Dames : une session expirée revient au formulaire sans création automatique', async ({ page }) => {
  const calls = await mockDame(page)
  await page.goto('/games/dame')
  await start(page)
  await page.route('**/api/games/dame/matches/*', (route) =>
    route.fulfill({ status: 404, json: { error: 'Rencontre introuvable.' } }),
  )
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Les joueurs' })).toBeVisible()
  await expect(page.getByRole('alert')).toContainText('Cette partie n’est plus disponible')
  expect(calls.filter((call) => call.method === 'POST')).toHaveLength(1)
  expect(await page.evaluate(() => sessionStorage.getItem('tiki.dame.match'))).toBeNull()
})

test('Dames : formulaire et damier accessibles sur mobile, sans débordement horizontal', async ({ page }, info) => {
  await mockDame(page)
  await page.setViewportSize({ width: 360, height: 900 })
  await page.goto('/games/dame')
  await expect(page.getByRole('button', { name: 'Commencer la partie' })).toBeEnabled()
  for (const stage of ['formulaire', 'damier']) {
    if (stage === 'damier') await start(page)
    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    expect(
      violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${stage}: ${v.id}`),
    ).toEqual([])
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  await page.screenshot({ path: info.outputPath('dame-mobile.png'), fullPage: true })
})
