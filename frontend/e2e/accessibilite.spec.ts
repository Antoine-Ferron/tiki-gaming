import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { mockPlatform } from './fixtures'

// Audit automatique WCAG 2.1 niveaux A et AA (axe-core) : aucune violation sérieuse ou critique tolérée.
for (const [page_, path, ready] of [
  ['accueil', '/', 'Bienvenue sur Tiki Gaming'],
  ['page de jeu', '/games/clicker', 'Clicker 10s'],
  ['page de jeu (démineur)', '/games/demineur', 'Démineur'],
  ['connexion', '/login', 'Connexion'],
  ['inscription', '/signup', 'Inscription'],
] as const) {
  test(`${page_} : conforme WCAG 2.1 AA`, async ({ page }) => {
    await mockPlatform(page, [{ user_id: 'a', username: 'alice', best_score: 50 }])
    await page.goto(path)
    await expect(page.getByRole('heading', { name: ready, exact: true }).first()).toBeVisible()

    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    const blocking = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')

    expect(
      blocking.map((v) => `${v.id} (${v.impact}) : ${v.help} — ${v.nodes.map((n) => n.target).join(', ')}`),
    ).toEqual([])
  })
}
