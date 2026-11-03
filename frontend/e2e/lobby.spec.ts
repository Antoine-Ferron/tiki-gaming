import { expect, test } from '@playwright/test'
import { mockPlatform } from './fixtures'

test.describe('lobby en invité', () => {
  test('de l’accueil au Clicker : avertissement invité et classement avec ex æquo', async ({ page }) => {
    await mockPlatform(page, [
      { user_id: 'b', username: 'bob', best_score: 50 },
      { user_id: 'a', username: 'alice', best_score: 50 },
      { user_id: 'c', username: 'carl', best_score: 40 },
    ])

    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Bienvenue sur Tiki Gaming' })).toBeVisible()
    await page.getByRole('link', { name: /Clicker 10s/ }).click()

    await expect(page).toHaveURL('/games/clicker')
    await expect(page.getByText('Tu joues en invité')).toBeVisible()
    const rows = page.locator('.leaderboard li')
    await expect(rows).toHaveCount(3)
    await expect(rows.locator('.rank')).toHaveText(['1', '1', '3'])
    await expect(rows.locator('.name')).toHaveText(['alice', 'bob', 'carl'])
  })

  test('une partie complète : score affiché, invitation à se connecter, sauvegarde sur l’appareil', async ({
    page,
  }) => {
    await mockPlatform(page)
    await page.clock.install()
    await page.goto('/games/clicker')

    await page.getByRole('button', { name: 'Jouer' }).click()
    const target = page.locator('button.big')
    for (let i = 0; i < 5; i++) await target.click()
    await page.clock.fastForward(10_500)

    await expect(page.getByText('Score : 5')).toBeVisible()
    await expect(page.getByText('Connecte-toi pour apparaître au classement.')).toBeVisible()
    await expect(page.getByText('Clics cumulés (sauvegarde) : 5')).toBeVisible()
    expect(await page.evaluate(() => localStorage.getItem('tiki:guest-save:clicker'))).toBe('{"totalClicks":5}')
  })

  // 502 (passerelle en panne) plutôt que 503 : postgrest-js retente lui-même les 503 pendant plusieurs secondes.
  test('Supabase en panne : message lisible, le jeu reste jouable', async ({ page }) => {
    await mockPlatform(page, { status: 502 })
    await page.goto('/games/clicker')

    await expect(page.getByText('Le serveur est injoignable. Vérifie ta connexion et réessaie.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Jouer' })).toBeEnabled()
  })

  test('une page réservée aux comptes renvoie vers la connexion', async ({ page }) => {
    await mockPlatform(page)
    await page.goto('/profile')

    await expect(page).toHaveURL('/login')
    await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible()
  })

  test('un jeu inconnu affiche la page introuvable', async ({ page }) => {
    await mockPlatform(page)
    await page.goto('/games/inexistant')

    await expect(page.getByRole('heading', { name: 'Page introuvable' })).toBeVisible()
  })
})
