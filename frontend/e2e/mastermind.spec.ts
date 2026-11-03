import { expect, test } from '@playwright/test'

test.describe('Mastermind', () => {
  test('displays the game, colors and initial attempts', async ({ page }) => {
    await page.goto('/games/mastermind')
    await expect(page.getByRole('heading', { name: 'Mastermind' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Rouge' })).toBeVisible()
    await expect(page.getByText('10 tentatives restantes')).toBeVisible()
  })

  test('builds a four-color proposal on the board', async ({ page }) => {
    await page.goto('/games/mastermind')
    await page.getByRole('button', { name: 'Rouge' }).click()
    await page.getByRole('button', { name: 'Bleu' }).click()
    await page.getByRole('button', { name: 'Vert' }).click()
    await page.getByRole('button', { name: 'Jaune' }).click()
    await expect(page.getByRole('button', { name: 'Rouge, cliquer pour modifier' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Valider la combinaison' })).toBeEnabled()
  })

  test('starts a new game after clicking Nouvelle partie', async ({ page }) => {
    await page.goto('/games/mastermind')
    await page.getByRole('button', { name: 'Rouge' }).click()
    await page.getByRole('button', { name: 'Nouvelle partie' }).click()
    await expect(page.getByText('10 tentatives restantes')).toBeVisible()
  })
})
