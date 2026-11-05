import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { mockPlatform } from './fixtures'

// Parcours vital de LemurTiki : le joueur trouve le jeu dans le catalogue et l'ouvre, en invité.
// L'écran est encore provisoire (le canvas arrive avec l'adaptateur) : on vérifie le chargement et l'accessibilité.
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

  test('aucune violation d’accessibilité WCAG 2.1 AA sérieuse ou critique sur la page du jeu', async ({ page }) => {
    await page.goto('/games/lemur')
    await expect(page.getByRole('heading', { name: 'LemurTiki', exact: true }).first()).toBeVisible()

    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    const blocking = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')

    expect(
      blocking.map((v) => `${v.id} (${v.impact}) : ${v.help} — ${v.nodes.map((n) => n.target).join(', ')}`),
    ).toEqual([])
  })
})
