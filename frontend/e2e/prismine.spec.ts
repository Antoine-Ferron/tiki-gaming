import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page, type Route } from '@playwright/test'
import { emptyGrid, prism, RED, SE, withPiece } from '../src/games/prismine/engine'
import { mockPlatform } from './fixtures'

const ID = 'e2e-prismine-run'
const RUNS = '/api/games/prismine/runs'
const FLOOR = { id: ID, depth: 1, size: 6, prisms: 1, obsidians: 1, colors: [1, 2] }
const NEW_RUN = { ...FLOOR, oil: 20, score: 0, floorErrors: 0, totalProbes: 0, totalErrors: 0, probes: [] }
const PROBE = { entry: 0, revealed: false, exit: 12, bounces: 1, color: RED }
const PROBED = { ...NEW_RUN, oil: 19, totalProbes: 1, probes: [PROBE] }
const NEXT_FLOOR = { ...NEW_RUN, depth: 2, oil: 29, score: 150, totalProbes: 1 }
const revealed = (depth: number) => ({
  ...FLOOR,
  depth,
  grid: withPiece(withPiece(emptyGrid(6), 0, prism(RED, SE)), 35, '#'),
  probes: [PROBE],
})

type Reply = { status?: number; json: unknown }
type Replies = Partial<Record<'start' | 'get' | 'probe' | 'validation' | 'end', Reply | Reply[]>>

/**
 * Simule le serveur arbitre par interception réseau, comme mockPlatform pour le reste de la plateforme : une action
 * non préparée répond 500 et fait échouer le test. Renvoie les corps envoyés au serveur et tout envoi de score.
 */
async function mockPrismine(page: Page, replies: Replies) {
  const sent: { action: string; body: unknown }[] = []
  const scores: string[] = []
  const reply = (route: Route, action: keyof Replies) => {
    sent.push({ action, body: route.request().postDataJSON() })
    const prepared = replies[action]
    const next = Array.isArray(prepared) ? prepared.shift() : prepared
    return route.fulfill(next ?? { status: 500, json: { error: `Action non préparée : ${action}` } })
  }
  await page.route(`**${RUNS}**`, (route) => {
    const { pathname } = new URL(route.request().url())
    if (pathname === RUNS) return reply(route, 'start')
    if (pathname.endsWith('/probes')) return reply(route, 'probe')
    if (pathname.endsWith('/validation')) return reply(route, 'validation')
    if (pathname.endsWith('/end')) return reply(route, 'end')
    return reply(route, 'get')
  })
  page.on('request', (request) => {
    if (/\/api\/scores|\/rest\/v1\/scores/.test(request.url())) scores.push(request.url())
  })
  return { sent, scores }
}

const hautA = (page: Page) => page.getByRole('button', { name: 'Haut A : envoyer un faisceau' })
const validateMap = (page: Page) => page.getByRole('button', { name: 'Valider ma carte' })

test.describe('Prismine', () => {
  test.beforeEach(async ({ page }) => {
    await mockPlatform(page)
    await page.goto('/games/prismine')
  })

  test('un invité joue une expédition complète, sans jamais envoyer de score', async ({ page }) => {
    const { sent, scores } = await mockPrismine(page, {
      start: { json: NEW_RUN },
      probe: { json: PROBED },
      validation: { json: { kind: 'cleared', points: 150, perfect: true, floor: revealed(1), run: NEXT_FLOOR } },
      end: { json: { floor: revealed(2), run: NEXT_FLOOR, recorded: false } },
    })

    await page.getByRole('button', { name: 'Jouer' }).click()
    await expect(page.getByText('À trouver : 1 prisme et 1 obsidienne')).toBeVisible()

    await hautA(page).click()
    await expect(page.getByText(/Haut A → Bas F/)).toBeVisible()

    await page.getByRole('button', { name: 'A1 : vide' }).click()
    await expect(page.getByRole('button', { name: 'A1 : prisme rouge, angle en bas à droite' })).toBeVisible()

    await validateMap(page).click()
    await expect(page.getByText(/Étage 1 réussi : \+150 points/)).toBeVisible()
    await page.getByRole('button', { name: "Descendre à l'étage 2" }).click()

    await page.getByRole('button', { name: "Terminer l'expédition" }).click()
    await page.getByRole('button', { name: 'Terminer', exact: true }).click()
    await expect(page.getByText("Expédition terminée à l'étage 2.")).toBeVisible()
    await expect(page.getByText('Connecte-toi pour apparaître au classement.')).toBeVisible()

    // Le navigateur envoie la carte du joueur ; le score, lui, ne part jamais du navigateur.
    expect(sent.find((s) => s.action === 'validation')?.body).toMatchObject({ guess: expect.stringMatching(/^a/) })
    expect(scores).toEqual([])
  })

  test('une carte contredite, puis fausse, et enfin une lampe éteinte', async ({ page }) => {
    await mockPrismine(page, {
      start: { json: NEW_RUN },
      probe: { json: PROBED },
      validation: [
        { json: { kind: 'contradiction', contradictions: [0] } },
        { json: { kind: 'wrong', entry: 5, run: { ...PROBED, oil: 16, floorErrors: 1 } } },
        { json: { kind: 'lamp-out', floor: revealed(1), run: { ...PROBED, oil: 2 }, recorded: false } },
      ],
    })

    await page.getByRole('button', { name: 'Jouer' }).click()
    await hautA(page).click()
    await expect(page.getByText(/Haut A → Bas F/)).toBeVisible()

    await validateMap(page).click()
    await expect(page.getByText(/Ta carte n'explique pas le tir 1/)).toBeVisible()
    await validateMap(page).click()
    await expect(page.getByText(/Raté : le tir depuis Haut F/)).toBeVisible()
    await validateMap(page).click()
    await expect(page.getByText("Ta lampe s'est éteinte à l'étage 1.")).toBeVisible()
  })

  test('une expédition en cours se reprend après un rechargement de la page', async ({ page }) => {
    await mockPrismine(page, { start: { json: NEW_RUN }, probe: { json: PROBED }, get: { json: PROBED } })

    await page.getByRole('button', { name: 'Jouer' }).click()
    await hautA(page).click()
    await expect(page.getByText(/Haut A → Bas F/)).toBeVisible()

    await page.reload()
    await expect(page.getByText(/Expédition en cours : étage 1, 19 doses d'huile/)).toBeVisible()
    await page.getByRole('button', { name: 'Reprendre' }).click()
    await expect(page.getByText(/Haut A → Bas F/)).toBeVisible()
  })

  test('un refus du serveur est expliqué au joueur, qui peut continuer', async ({ page }) => {
    await mockPrismine(page, {
      start: [{ status: 503, json: { error: 'Le serveur de jeu est indisponible.' } }, { json: NEW_RUN }],
      probe: { status: 409, json: { error: "Ta lampe est vide : valide ta carte ou termine l'expédition." } },
    })

    await page.getByRole('button', { name: 'Jouer' }).click()
    // Panne (5xx) : message générique, le détail du serveur n'est pas montré au joueur.
    await expect(
      page.getByText('Le serveur de Prismine ne répond pas. Vérifie ta connexion et réessaie.'),
    ).toBeVisible()
    await expect(page.getByText('Le serveur de jeu est indisponible.')).toBeHidden()

    await page.getByRole('button', { name: 'Jouer' }).click()
    // Refus (4xx) : le message du serveur explique au joueur ce qu'il peut faire.
    await hautA(page).click()
    await expect(page.getByText(/Ta lampe est vide/)).toBeVisible()
    await expect(validateMap(page)).toBeEnabled()
  })

  test('l’écran de jeu est conforme WCAG 2.1 AA', async ({ page }) => {
    await mockPrismine(page, { start: { json: NEW_RUN } })
    await page.getByRole('button', { name: 'Jouer' }).click()
    await expect(page.getByText('À trouver : 1 prisme et 1 obsidienne')).toBeVisible()

    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    const blocking = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')

    expect(
      blocking.map((v) => `${v.id} (${v.impact}) : ${v.help} — ${v.nodes.map((n) => n.target).join(', ')}`),
    ).toEqual([])
  })
})
