import { expect, test, type Page } from '@playwright/test'
import type { GameView } from '../src/games/bang/board/view'

async function login(page: Page, seat: number) {
  await page.goto('/login')
  await page.getByLabel('Email', { exact: true }).fill(`bang${seat}@example.test`)
  await page.getByLabel('Mot de passe', { exact: true }).fill('bang-browser-test-only')
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click()
  await expect(page.getByRole('heading', { name: `Salut bang_test_${seat} 👋` })).toBeVisible()
}

async function openFromCatalog(page: Page) {
  await page.goto('/?categorie=multi')
  await page.getByRole('link', { name: /^BANG !/ }).click()
  await expect(page).toHaveURL('/games/bang')
}

async function postAs(page: Page, path: string) {
  const token = (await page.context().cookies()).find((c) => c.name === 'XSRF-TOKEN')!.value
  return page.request.post(path, { headers: { 'X-XSRF-TOKEN': decodeURIComponent(token) }, data: {} })
}

function checkPrivacy(views: GameView[]) {
  expect(views.map((view) => view.seat)).toEqual([1, 2, 3, 4])
  expect(views.map((view) => view.role)).toEqual(['SHERIFF', 'OUTLAW', 'OUTLAW', 'RENEGADE'])
  for (const view of views) {
    const allowed = ['code', 'seat', 'currentSeat', 'phase', 'role', 'hand', 'players']
    if (view.pendingShot) allowed.push('pendingShot')
    expect(Object.keys(view).sort()).toEqual(allowed.sort())
    for (const player of view.players) {
      const keys = ['seat', 'character', 'health', 'maxHealth', 'playedCards', 'handCount']
      if (player.seat === 1) keys.push('role')
      expect(Object.keys(player).sort()).toEqual(keys.sort())
      expect(player.role).toBe(player.seat === 1 ? 'SHERIFF' : undefined)
    }
    const json = JSON.stringify(view)
    for (const other of views.filter((v) => v.seat !== view.seat)) {
      for (const card of other.hand) expect(json).not.toContain(`"${card.id}"`)
    }
  }
}

async function checkMats(pages: Page[], views: GameView[]) {
  checkPrivacy(views)
  const roles = ['Shérif', 'Hors-la-loi', 'Hors-la-loi', 'Renégat']
  for (const [index, page] of pages.entries()) {
    expect(views[index].players).toEqual(views[0].players)
    await expect(page.getByRole('region', { name: /^Tapis de la place/ })).toHaveCount(4)
    await expect(page.getByText('Shérif', { exact: true })).toBeVisible()
    await expect(
      page.getByRole('region', { name: `Tapis de la place ${index + 1}` }).getByText('Rôle privé'),
    ).toBeVisible()
    await expect(
      page.getByRole('region', { name: `Tapis de la place ${index + 1}` }).getByText(roles[index], { exact: true }),
    ).toBeVisible()
    await expect(page.getByRole('region', { name: 'Ta main' }).getByRole('listitem')).toHaveCount(
      views[index].hand.length,
    )
    for (const player of views[index].players) {
      const mat = page.getByRole('region', { name: `Tapis de la place ${player.seat}` })
      await expect(mat.getByText(`${player.health}/${player.maxHealth} PV`, { exact: true })).toBeVisible()
      await expect(mat.getByText(`${player.handCount} en main`, { exact: true })).toBeVisible()
    }
  }
}

test('du catalogue au tour suivant à quatre : esquive, reconnexion, acceptation et vues privées', async ({
  browser,
}, testInfo) => {
  const contexts = await Promise.all(Array.from({ length: 4 }, () => browser.newContext()))
  const pages = await Promise.all(contexts.map((context) => context.newPage()))
  const views: GameView[] = []
  const errors: string[] = []
  for (const [index, page] of pages.entries()) {
    page.on('pageerror', (err) => errors.push(err.message))
    page.on('response', async (response) => {
      if (/\/api\/games\/bang\/tables\/[^/]+\/state$/.test(response.url()) && response.status() === 200) {
        views[index] = (await response.json()) as GameView
      }
    })
  }

  try {
    await test.step('quatre comptes ouvrent BANG! depuis le catalogue multijoueur', async () => {
      for (const [index, page] of pages.entries()) {
        await login(page, index + 1)
        await openFromCatalog(page)
      }
    })

    let code = ''
    await test.step('créer, rejoindre par code et démarrer à quatre', async () => {
      const creation = pages[0].waitForResponse(
        (r) => r.url().endsWith('/api/games/bang/tables') && r.request().method() === 'POST',
      )
      await pages[0].getByRole('button', { name: 'Créer une table' }).click()
      const response = await creation
      expect(response.status()).toBe(201)
      code = ((await response.json()) as { code: string }).code
      for (const page of pages.slice(1)) {
        const joining = page.waitForResponse((r) => r.url().endsWith('/join') && r.request().method() === 'POST')
        await page.getByLabel('Code de la table').fill(` ${code.toLowerCase()} `)
        await page.getByRole('button', { name: 'Rejoindre', exact: true }).click()
        expect((await joining).status()).toBe(200)
      }
      await pages[0].getByRole('button', { name: 'Démarrer la partie' }).click()
      await expect.poll(() => views.filter(Boolean).length).toBe(4)
      await checkMats(pages, views)
    })

    const table = `/api/games/bang/tables/${code}`
    const sheriff = pages[0]
    const target = pages[1]
    await test.step('le Shérif pioche deux cartes depuis le plateau', async () => {
      const before = views[0].hand.length
      await sheriff.getByRole('button', { name: 'Piocher', exact: true }).click()
      await expect.poll(() => views[0].phase).toBe('PLAY')
      expect(views[0].hand).toHaveLength(before + 2)
    })

    let oldShot = ''
    for (const variant of ['esquiver', 'accepter'] as const) {
      await test.step(`tirer puis ${variant} après reprise de la cible`, async () => {
        const before = (await (await target.request.get(`${table}/state`)).json()) as GameView
        await sheriff
          .getByRole('region', { name: 'Ta main' })
          .getByRole('button', { name: 'BANG !', exact: true })
          .first()
          .click()
        await sheriff.getByRole('button', { name: 'Viser la place 2' }).click()
        await expect.poll(() => views.every((v) => !!v.pendingShot && v.pendingShot.id !== oldShot)).toBe(true)
        const shot = views[0].pendingShot!
        expect(shot).toMatchObject({ shooterSeat: 1, targetSeat: 2 })
        for (const view of views) expect(view.pendingShot).toEqual(shot)
        await expect(sheriff.getByRole('button', { name: 'Finir le tour' })).toHaveCount(0)

        if (variant === 'esquiver') {
          await target.reload()
        } else {
          const previousSession = (await target.context().cookies()).find((c) => c.name === 'JSESSIONID')!.value
          const logout = target.waitForResponse(
            (r) => r.url().endsWith('/api/auth/logout') && r.request().method() === 'POST',
          )
          await target.getByRole('button', { name: 'Déconnexion', exact: true }).click()
          expect((await logout).status()).toBe(204)
          await expect(target).toHaveURL('/')
          await login(target, 2)
          const nextSession = (await target.context().cookies()).find((c) => c.name === 'JSESSIONID')!.value
          expect(nextSession).not.toBe(previousSession)
          await openFromCatalog(target)
          const stale = await postAs(target, `${table}/shots/${oldShot}/accept`)
          expect(stale.status()).toBe(409)
        }
        await expect(target.getByRole('status')).toHaveText('La place 1 te vise : esquive ou accepte le tir.')
        expect(((await (await target.request.get(`${table}/state`)).json()) as GameView).pendingShot).toEqual(shot)
        await checkMats(pages, views)

        const path =
          variant === 'esquiver'
            ? `${table}/shots/${shot.id}/dodge/${before.hand.find((c) => c.type === 'MISSED')!.id}`
            : `${table}/shots/${shot.id}/accept`
        const reply = target.waitForResponse(
          (r) => new URL(r.url()).pathname === path && r.request().method() === 'POST',
        )
        await target
          .getByRole('button', {
            name: variant === 'esquiver' ? 'Esquiver avec Raté !' : 'Accepter le tir',
            exact: true,
          })
          .first()
          .click()
        expect((await reply).status()).toBe(204)
        await expect.poll(() => views.every((v) => !v.pendingShot)).toBe(true)
        const targetBefore = before.players[1]
        expect(views[0].players[1].health).toBe(targetBefore.health - (variant === 'accepter' ? 1 : 0))
        // La cible est Bart : l'acceptation ajoute sa carte bonus, l'esquive en consomme une.
        expect(views[1].hand.length).toBe(before.hand.length + (variant === 'accepter' ? 1 : -1))
        await checkMats(pages, views)
        const stable = (await (await target.request.get(`${table}/state`)).json()) as GameView
        expect((await postAs(target, path)).status()).toBe(409)
        expect(await (await target.request.get(`${table}/state`)).json()).toEqual(stable)
        oldShot = shot.id
      })
    }

    await test.step('le Shérif finit et les quatre sessions voient le joueur suivant', async () => {
      await sheriff.getByRole('button', { name: 'Finir le tour' }).click()
      await expect.poll(() => views.every((v) => v.currentSeat === 2 && v.phase === 'DRAW')).toBe(true)
      await expect(target.getByRole('button', { name: 'Piocher', exact: true })).toBeVisible()
      for (const page of [pages[0], pages[2], pages[3]])
        await expect(page.getByRole('status')).toHaveText('Au tour de la place 2.')
      await checkMats(pages, views)
    })
    expect(errors).toEqual([])
    for (const [index, page] of pages.entries()) {
      const screenshot = testInfo.outputPath(`place-${index + 1}.png`)
      await page.screenshot({ path: screenshot, fullPage: true })
      await testInfo.attach(`Place ${index + 1}`, { path: screenshot, contentType: 'image/png' })
    }
  } finally {
    await Promise.all(contexts.map((context) => context.close()))
  }
})
