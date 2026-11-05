import { expect, test } from '@playwright/test'
import { mockPlatform } from './fixtures'

test.describe('Yams', () => {
  test.beforeEach(async ({ page }) => {
    await mockPlatform(page)
    await page.addInitScript(() => {
      Math.random = () => 0.5
    })
  })

  test('le joueur 1 lance, garde un dé, relance puis choisit une case : la main passe au joueur 2', async ({
    page,
  }) => {
    await page.goto('/games/yams')

    await page.getByRole('button', { name: 'Lancer les dés' }).click()
    await page.getByRole('button', { name: 'Dé 1 : 4' }).click()
    await expect(page.getByRole('button', { name: 'Dé 1 : 4, gardé' })).toBeVisible()

    await page.getByRole('button', { name: 'Relancer (2)' }).click()
    await page.getByRole('button', { name: '50' }).click()

    await expect(page.locator('strong').filter({ hasText: 'Joueur 2' })).toBeVisible()
  })
})
