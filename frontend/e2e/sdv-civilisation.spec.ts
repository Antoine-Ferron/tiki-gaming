import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { mockPlatform } from './fixtures'
import { BUILT_CARD, STALE, WONDER, mockSdvCivilisation } from './sdv-civilisation.fixtures'

// Partie de SDV Civilisation en invité. Le backend du jeu est un faux serveur qui rejoue les vues du contrat
// (GameViewContractTest) ; le minuteur de 60 s n'expire jamais ici (son expiration est couverte en unitaire).

const hand = (page: Page) => page.getByRole('region', { name: /^Ta main/ })
// Les cartes de la main : leur nom accessible décrit l'effet et finit par le coût et le statut.
const handCards = (page: Page) => hand(page).getByRole('button', { name: /, coût / })
const myCity = (page: Page) => page.getByRole('list', { name: 'Tes bâtiments' })

async function startAsGuest(page: Page) {
  await page.goto('/games/sdv-civilisation')
  await expect(page.getByRole('heading', { name: 'Choisis ta merveille' })).toBeVisible()
  await page.getByRole('button', { name: `Choisir ${WONDER}` }).click()
  await expect(page.getByRole('heading', { name: /^Ta main · 7 cartes à jouer/ })).toBeVisible()
}

async function buildTheContractCard(page: Page) {
  // Sans animation : le tour suivant s'affiche dès la réponse du serveur.
  await page.getByLabel('Animations').selectOption({ label: 'Désactivées' })
  await handCards(page).filter({ hasText: BUILT_CARD }).click()
  await page.getByRole('button', { name: new RegExp(`^Construire ${BUILT_CARD}`) }).click()
}

async function audit(page: Page) {
  // L'audit porte sur l'écran tel que le joueur le lit : une fois les cartes arrivées (animations terminées).
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'))
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  const describe = (impacts: string[]) =>
    violations
      .filter((v) => impacts.includes(v.impact ?? ''))
      .map((v) => `${v.id} (${v.impact}) : ${v.help} — ${v.nodes.map((n) => n.target).join(', ')}`)
  return { blocking: describe(['serious', 'critical']), minor: describe(['moderate', 'minor']) }
}

test.describe('SDV Civilisation en invité', () => {
  test.beforeEach(async ({ page, context }) => {
    await mockPlatform(page)
    await mockSdvCivilisation(context)
  })

  test('démarrer une partie : merveille choisie, main de 7 cartes et minuteur', async ({ page }) => {
    // Étant donné un invité sur la page du jeu, sans partie en cours
    // Quand il choisit la Citadelle d'Orkan
    await startAsGuest(page)

    // Alors sa main de 7 cartes et le minuteur du tour s'affichent
    await expect(handCards(page)).toHaveCount(7)
    await expect(page.getByRole('timer', { name: /^Temps restant pour jouer/ })).toBeVisible()
    await expect(myCity(page).getByRole('listitem', { name: new RegExp(`^${BUILT_CARD} :`) })).toHaveCount(0)
  })

  test('jouer un coup : la carte construite rejoint la cité et le tour 2 commence', async ({ page }) => {
    // Étant donné une partie commencée
    await startAsGuest(page)

    // Quand l'invité construit l'Atelier
    await buildTheContractCard(page)

    // Alors le tour suivant s'affiche, avec une carte de moins en main, et l'Atelier est dans sa cité
    await expect(page.getByRole('heading', { name: /^Ta main · 6 cartes à jouer/ })).toBeVisible()
    await expect(page.getByText(/Tour\s+2\s+\/\s+6/)).toBeVisible()
    await expect(myCity(page).getByRole('listitem', { name: new RegExp(`^${BUILT_CARD} :`) })).toBeVisible()
  })

  test('reprise : après rechargement, la partie revient au même tour avec la même cité', async ({ page }) => {
    // Étant donné une partie au tour 2, l'Atelier construit
    await startAsGuest(page)
    await buildTheContractCard(page)
    await expect(page.getByRole('heading', { name: /^Ta main · 6 cartes à jouer/ })).toBeVisible()

    // Quand l'invité recharge la page
    await page.reload()

    // Alors la partie est reprise au tour 2, avec la même main et la même cité
    await expect(page.getByRole('status').filter({ hasText: /Partie reprise : âge .+, tour 2\./ })).toBeVisible()
    await expect(handCards(page)).toHaveCount(6)
    await expect(myCity(page).getByRole('listitem', { name: new RegExp(`^${BUILT_CARD} :`) })).toBeVisible()
  })

  test('accessibilité : écran de jeu et fenêtre des règles conformes WCAG 2.1 AA', async ({ page }, testInfo) => {
    // Étant donné une partie en cours, merveille choisie
    await startAsGuest(page)

    // Quand l'écran de jeu, puis la fenêtre des règles, sont audités par axe
    const board = await audit(page)
    await page.getByRole('button', { name: 'Règles' }).click()
    await expect(page.getByRole('dialog', { name: 'Règles du jeu' })).toBeVisible()
    const rules = await audit(page)

    // Alors aucune violation sérieuse ou critique ; les mineures et modérées sont jointes au rapport
    await testInfo.attach('axe-sdv-civilisation.json', {
      body: JSON.stringify({ ecranDeJeu: board, reglesDuJeu: rules }, null, 2),
      contentType: 'application/json',
    })
    expect(board.blocking).toEqual([])
    expect(rules.blocking).toEqual([])
  })

  test('deux onglets : un coup joué depuis l’onglet périmé est refusé et resynchronisé', async ({ page, context }) => {
    // Étant donné la même partie ouverte dans deux onglets
    await startAsGuest(page)
    const stale = await context.newPage()
    await mockPlatform(stale)
    await stale.goto('/games/sdv-civilisation')
    await expect(stale.getByRole('heading', { name: /^Ta main · 7 cartes à jouer/ })).toBeVisible()

    // Quand le premier onglet joue l'Atelier, puis le second rejoue la même carte sur l'ancien tour
    await buildTheContractCard(page)
    await expect(page.getByRole('heading', { name: /^Ta main · 6 cartes à jouer/ })).toBeVisible()
    await buildTheContractCard(stale)

    // Alors le second onglet affiche le refus du serveur (409) et le tour en cours
    await expect(stale.getByRole('status').filter({ hasText: STALE })).toBeVisible()
    await expect(stale.getByRole('heading', { name: /^Ta main · 6 cartes à jouer/ })).toBeVisible()
  })
})
