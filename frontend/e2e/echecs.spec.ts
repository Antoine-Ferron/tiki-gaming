import { expect, test } from '@playwright/test'
import { mockPlatform } from './fixtures'

// Parcours vital du jeu d'échecs (cours J3_PM : un seul E2E, les règles restent testées en unitaire côté Java).
// Le backend Java est simulé par interception réseau, comme pour les autres jeux : le test est déterministe.
const AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1'

test.describe('Échecs', () => {
  test.beforeEach(async ({ page }) => {
    await mockPlatform(page)
    await page.route('**/api/games/echecs/destinations', (route) =>
      route.fulfill({ json: { destinations: ['e3', 'e4'] } }),
    )
    await page.route('**/api/games/echecs/moves', (route) =>
      route.fulfill({ json: { fen: AFTER_E4, status: 'ONGOING' } }),
    )
  })

  test('ouvrir le jeu, choisir le pion e2 et le jouer en e4', async ({ page }) => {
    await page.goto('/games/echecs')
    await expect(page.getByRole('status')).toHaveText('Aux Blancs de jouer')

    await page.getByRole('button', { name: 'e2, pion blanc' }).click()
    await expect(page.getByRole('button', { name: 'e2, pion blanc' })).toHaveAttribute('aria-pressed', 'true')
    await page.getByRole('button', { name: 'e4, case vide' }).click()

    await expect(page.getByRole('button', { name: 'e4, pion blanc' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'e2, case vide' })).toBeVisible()
    await expect(page.getByRole('status')).toHaveText('Aux Noirs de jouer')
  })
})
