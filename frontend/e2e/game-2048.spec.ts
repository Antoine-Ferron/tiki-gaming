import { expect, type Page, test } from '@playwright/test'
import { mockPlatform } from './fixtures'

/** Hasard fixé (stub) : chaque nouvelle tuile est un 2, posé sur la première case vide. */
async function fixRandom(page: Page) {
  await page.addInitScript(() => {
    Math.random = () => 0
  })
}

/** La grille est lue par son rôle et le nom accessible de chaque case : son nombre, ou « vide ». */
async function expectFirstRow(page: Page, names: string[]) {
  const cells = page.getByRole('gridcell')
  for (const [i, name] of names.entries()) await expect(cells.nth(i)).toHaveAccessibleName(name)
}

test.describe('2048', () => {
  test('de l’accueil au jeu : un coup au clavier fusionne les tuiles et fait monter le score', async ({ page }) => {
    // Arrange
    await mockPlatform(page)
    await fixRandom(page)
    await page.goto('/')
    await page.getByRole('link', { name: /2048/ }).click()
    await expect(page).toHaveURL('/games/game-2048')
    await expect(page.getByText('Score : 0')).toBeVisible()

    // Act
    await page.keyboard.press('ArrowLeft')

    // Assert : 2 + 2 → 4, puis un nouveau 2 apparaît
    await expect(page.getByText('Score : 4')).toBeVisible()
    await expectFirstRow(page, ['4', '2', 'vide', 'vide'])
  })

  test('un invité retrouve son record après avoir rechargé la page', async ({ page }) => {
    // Arrange
    await mockPlatform(page)
    await fixRandom(page)
    await page.goto('/games/game-2048')
    await expect(page.getByText('Score : 0')).toBeVisible()
    await page.keyboard.press('ArrowLeft')
    await expect(page.getByText('Score : 4')).toBeVisible()

    // Act : il abandonne la partie, ce qui la termine, puis recharge
    await page.getByRole('button', { name: 'Nouvelle partie' }).click()
    await expect(page.getByText('Record : 4')).toBeVisible()
    await page.reload()

    // Assert : le record est relu depuis le navigateur
    await expect(page.getByText('Record : 4')).toBeVisible()
    await expect(page.getByText('Connecte-toi pour apparaître au classement.')).toBeVisible()
  })

  test('classement en panne : le joueur est prévenu et le jeu reste jouable (dégradation gracieuse)', async ({
    page,
  }) => {
    // Arrange : Supabase répond 502 au classement (un 503 serait retenté par postgrest-js)
    await mockPlatform(page, { status: 502 })
    await fixRandom(page)
    await page.goto('/games/game-2048')
    await expect(page.getByText('Score : 0')).toBeVisible()

    // Act
    await page.keyboard.press('ArrowLeft')

    // Assert
    await expect(page.getByText('Le serveur est injoignable. Vérifie ta connexion et réessaie.')).toBeVisible()
    await expect(page.getByText('Score : 4')).toBeVisible()
  })
})
