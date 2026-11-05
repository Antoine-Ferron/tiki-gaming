import { expect, test, type Page } from '@playwright/test'
import { mockPlatform } from './fixtures'

test.describe('Mastermind', () => {
  test.beforeEach(async ({ page }) => {
    await mockPlatform(page)
  })

  test('displays the game, colors and initial attempts', async ({ page }) => {
    await page.goto('/games/mastermind')
    await expect(page.getByRole('heading', { name: 'Mastermind' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Rouge' })).toBeVisible()
    await expect(page.getByText('10 tentatives restantes')).toBeVisible()
  })

  test('builds a four-color proposal on the board', async ({ page }) => {
    await page.goto('/games/mastermind')
    await expect(page.getByText('10 tentatives restantes')).toBeVisible()
    await page.getByRole('button', { name: 'Rouge' }).click()
    await page.getByRole('button', { name: 'Bleu' }).click()
    await page.getByRole('button', { name: 'Vert' }).click()
    await page.getByRole('button', { name: 'Jaune' }).click()
    await expect(page.getByRole('button', { name: 'Rouge, cliquer pour modifier' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Valider la combinaison' })).toBeEnabled()
  })

  test('starts a new game after clicking Nouvelle partie', async ({ page }) => {
    await page.goto('/games/mastermind')
    await expect(page.getByText('10 tentatives restantes')).toBeVisible()
    await page.getByRole('button', { name: 'Rouge' }).click()
    await page.getByRole('button', { name: 'Nouvelle partie' }).click()
    await expect(page.getByText('10 tentatives restantes')).toBeVisible()
  })

  test('completes a winning game and displays the score', async ({ page }) => {
    await page.goto('/games/mastermind')
    await expect(page.getByText('10 tentatives restantes')).toBeVisible()
    await page.route('**/api/games/mastermind/*/guesses', (route) =>
      route.fulfill({
        json: {
          id: 'e2e-mastermind-game',
          status: 'WON',
          attemptsUsed: 1,
          attemptsRemaining: 9,
          history: [],
          secret: ['red', 'blue', 'green', 'yellow'],
          score: 10,
        },
      }),
    )
    await fillGuess(page)
    await page.getByRole('button', { name: 'Valider la combinaison' }).click()

    await expect(page.getByText('Bravo, combinaison trouvée !')).toBeVisible()
    await expect(page.locator('.mastermind-result')).toContainText('10 points')
  })

  test('ends after ten incorrect guesses', async ({ page }) => {
    await page.goto('/games/mastermind')
    await expect(page.getByText('10 tentatives restantes')).toBeVisible()
    let attempts = 0
    await page.route('**/api/games/mastermind/*/guesses', (route) => {
      attempts += 1
      return route.fulfill({
        json: {
          id: 'e2e-mastermind-game',
          status: attempts === 10 ? 'LOST' : 'IN_PROGRESS',
          attemptsUsed: attempts,
          attemptsRemaining: 10 - attempts,
          history: [],
          secret: attempts === 10 ? ['red', 'blue', 'green', 'yellow'] : null,
          score: 0,
        },
      })
    })

    for (let attempt = 0; attempt < 10; attempt++) {
      await fillGuess(page)
      await page.getByRole('button', { name: 'Valider la combinaison' }).click()
      if (attempt < 9)
        await expect(
          page.getByText(`${9 - attempt} tentative${attempt === 8 ? '' : 's'} restante${attempt === 8 ? '' : 's'}`),
        ).toBeVisible()
    }
    await expect(page.getByText('Partie terminée.')).toBeVisible()
  })

  test('replaces an expired game after an API 404', async ({ page }) => {
    await page.goto('/games/mastermind')
    await expect(page.getByText('10 tentatives restantes')).toBeVisible()
    await page.route('**/api/games/mastermind/*/restart', (route) =>
      route.fulfill({ status: 404, json: { error: 'Partie introuvable.' } }),
    )
    await page.getByRole('button', { name: 'Nouvelle partie' }).click()

    await expect(page.getByText('Ta partie avait expiré : une nouvelle partie a été créée.')).toBeVisible()
  })

  test('supports keyboard selection and resumes after reload', async ({ page }) => {
    await page.goto('/games/mastermind')
    const red = page.getByRole('button', { name: 'Rouge' })
    await red.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('button', { name: 'Rouge, cliquer pour modifier' })).toBeVisible()

    await page.reload()
    await expect(page.getByRole('heading', { name: 'Décode la combinaison' })).toBeVisible()
    await expect(page.getByText(/tentative.*restante/)).toBeVisible()
  })

  test('displays an API error without breaking the board', async ({ page }) => {
    await page.goto('/games/mastermind')
    await expect(page.getByText('10 tentatives restantes')).toBeVisible()
    await page.route('**/api/games/mastermind/**', (route) => route.abort())
    await page.getByRole('button', { name: 'Nouvelle partie' }).click()

    await expect(page.locator('.mastermind-board .error')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Rouge' })).toBeVisible()
  })
})

async function fillGuess(page: Page) {
  await page.getByRole('button', { name: 'Rouge' }).click()
  await page.getByRole('button', { name: 'Bleu' }).click()
  await page.getByRole('button', { name: 'Vert' }).click()
  await page.getByRole('button', { name: 'Jaune' }).click()
}
