import { expect, test } from '@playwright/test'
import { mockPlatform } from './fixtures'

test.describe('Tic-Tac-Toe', () => {
  test.beforeEach(async ({ page }) => {
    await mockPlatform(page)
  })

  test('joue une partie et affiche le gagnant et le score de session', async ({ page }) => {
    await page.goto('/games/tic-tac-toe')

    await expect(page.getByRole('heading', { name: 'Tic-Tac-Toe' })).toBeVisible()
    await expect(page.getByRole('grid', { name: 'Grille de Tic-Tac-Toe' })).toBeVisible()
    await expect(page.getByLabel('Score de la session')).toContainText('X 0')

    for (const cell of [
      [1, 1],
      [2, 1],
      [1, 2],
      [2, 2],
      [1, 3],
    ]) {
      await page.getByRole('gridcell', { name: `Ligne ${cell[0]}, colonne ${cell[1]}, vide` }).click()
    }

    await expect(page.getByRole('status')).toContainText('Le joueur X a gagné !')
    await expect(page.locator('.tic-tac-toe-victory')).toContainText('VICTOIRE !')
    await expect(page.locator('.tic-tac-toe-winner')).toContainText('Joueur X gagne')
    await expect(page.getByLabel('Score de la session')).toContainText('X 1')
  })

  test('rejoue une partie en conservant le score de session', async ({ page }) => {
    await page.goto('/games/tic-tac-toe')

    for (const cell of [
      [1, 1],
      [2, 1],
      [1, 2],
      [2, 2],
      [1, 3],
    ]) {
      await page.getByRole('gridcell', { name: `Ligne ${cell[0]}, colonne ${cell[1]}, vide` }).click()
    }

    await page.getByRole('button', { name: 'Rejouer' }).click()
    await expect(page.getByRole('status')).toContainText('Tour du joueur X')
    await expect(page.getByRole('gridcell', { name: 'Ligne 1, colonne 1, vide' })).toBeEnabled()
    await expect(page.getByLabel('Score de la session')).toContainText('X 1')
  })
})
