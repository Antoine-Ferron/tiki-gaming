import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'
import { mockPlatform } from './fixtures'

// Parcours vitaux de LemurTiki, en invité : trouver le jeu, jouer une partie jusqu'au bout, rejouer.
// Le temps est piloté par page.clock et le hasard est fixé (Stub) : aucune attente réelle, partie reproductible.

/** Hasard à 0 : toutes les branches poussent au bord gauche, loin du maki, qui rebondit sur place. */
async function fixRandom(page: Page) {
  await page.addInitScript(() => {
    Math.random = () => 0
  })
}
test.describe('LemurTiki', () => {
  test.beforeEach(async ({ page }) => {
    await mockPlatform(page)
  })

  test('de l’accueil au jeu : un invité ouvre LemurTiki depuis le catalogue', async ({ page }) => {
    // Arrange
    await page.goto('/')

    // Act
    await page.getByRole('link', { name: /LemurTiki/ }).click()

    // Assert
    await expect(page).toHaveURL('/games/lemur')
    await expect(page.getByRole('heading', { name: 'LemurTiki', exact: true }).first()).toBeVisible()
    await expect(page.getByText(/grimpe le baobab/i).first()).toBeVisible()
  })

  test('une partie complète : le maki rebondit, la fossa l’attrape, puis Rejouer relance à 0 m', async ({ page }) => {
    // Arrange
    await fixRandom(page)
    await page.clock.install()
    await page.goto('/games/lemur')

    // Act
    await page.getByRole('button', { name: 'Jouer' }).click()
    await expect(page.getByText('Hauteur : 0 m')).toBeVisible()
    await expect(page.getByRole('img', { name: /maki/ })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('heading', { name: 'Pause' })).toBeVisible()
    await page.keyboard.press('p')
    await page.clock.runFor(20_000)

    // Assert
    await expect(page.getByRole('heading', { name: 'Partie terminée' })).toBeVisible()
    await expect(page.getByText('La fossa t’a attrapé !')).toBeVisible()
    await expect(page.getByRole('status')).toHaveText('Connecte-toi pour apparaître au classement.')
    await page.getByRole('button', { name: 'Rejouer' }).click()
    await expect(page.getByText('Hauteur : 0 m')).toBeVisible()
  })

  test('aucune violation d’accessibilité WCAG 2.1 AA sérieuse ou critique sur la page du jeu', async ({ page }) => {
    await page.goto('/games/lemur')
    await expect(page.getByRole('heading', { name: 'LemurTiki', exact: true }).first()).toBeVisible()
    await page.getByRole('button', { name: 'Jouer' }).click()
    await expect(page.getByText('Hauteur : 0 m')).toBeVisible()

    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    const blocking = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')

    expect(
      blocking.map((v) => `${v.id} (${v.impact}) : ${v.help} — ${v.nodes.map((n) => n.target).join(', ')}`),
    ).toEqual([])
  })
})
