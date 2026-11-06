import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { mockPlatform } from './fixtures'
import { EMPTY_CELLS, SERVER_SCORE, SOLUTION, mockSudokuApi, wrongDigitFor } from './sudokuServer'

// Parcours critiques du Sudoku dans un vrai navigateur. Le backend (/api/games/sudoku) et Supabase sont simulés :
// le faux serveur applique les règles du vrai (erreurs comptées côté serveur, 4e erreur = partie perdue).
const cell = (page: Page, index: number) =>
  page.getByRole('button', { name: new RegExp(`^Ligne ${Math.floor(index / 9) + 1}, colonne ${(index % 9) + 1}, `) })
const pad = (page: Page, digit: number) => page.getByRole('button', { name: String(digit), exact: true })

async function startEasyGame(page: Page) {
  await page.goto('/games/sudoku')
  await page.getByRole('button', { name: 'Facile' }).click()
  await expect(page.getByRole('group', { name: 'Grille de sudoku' })).toBeVisible()
}

async function fillCell(page: Page, index: number, digit: number) {
  await cell(page, index).click()
  await pad(page, digit).click()
}

test.describe('Sudoku', () => {
  test.beforeEach(async ({ page }) => {
    await mockPlatform(page, [{ user_id: 'a', username: 'alice', best_score: 2000 }])
  })

  test('le menu propose les trois difficultés et affiche le classement', async ({ page }) => {
    await mockSudokuApi(page)
    await page.goto('/games/sudoku')

    await expect(page.getByRole('heading', { name: 'Sudoku', exact: true }).first()).toBeVisible()
    for (const level of ['Facile', 'Moyen', 'Difficile']) {
      await expect(page.getByRole('button', { name: level })).toBeVisible()
    }
    await expect(page.getByText('alice')).toBeVisible()
  })

  test('une partie gagnée affiche le score calculé par le serveur', async ({ page }) => {
    const server = await mockSudokuApi(page)
    await startEasyGame(page)

    for (const index of EMPTY_CELLS) await fillCell(page, index, SOLUTION[index])

    await expect(page.getByText(/Bravo/)).toContainText(String(SERVER_SCORE))
    await expect(page.getByText('Connecte-toi pour apparaître au classement.')).toBeVisible()
    expect(server.calls.checks).toBe(1)
  })

  test('un chiffre faux laisse la case vide et compte une erreur', async ({ page }) => {
    const server = await mockSudokuApi(page)
    await startEasyGame(page)
    const target = EMPTY_CELLS[1]

    await fillCell(page, target, wrongDigitFor(target))

    await expect(page.getByText('Erreurs : 1/3')).toBeVisible()
    await expect(page.getByRole('status')).toContainText('pas le bon')
    await expect(cell(page, target)).toHaveAccessibleName(/vide$/)
    expect(server.calls.moves).toBe(1)
  })

  test('un indice de départ est verrouillé : aucune saisie n’est envoyée', async ({ page }) => {
    const server = await mockSudokuApi(page)
    await startEasyGame(page)

    await cell(page, 0).click()
    await pad(page, 9).click()

    await expect(page.getByText('Erreurs : 0/3')).toBeVisible()
    expect(server.calls.moves).toBe(0)
  })

  test('la grille se joue au clavier : flèches puis chiffre', async ({ page }) => {
    await mockSudokuApi(page)
    await startEasyGame(page)
    const [top, middle] = EMPTY_CELLS

    await cell(page, top).click()
    for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowDown')
    await page.keyboard.press(String(SOLUTION[middle]))

    await expect(cell(page, middle)).toHaveAccessibleName(new RegExp(`${SOLUTION[middle]}$`))
    await expect(page.getByText('Erreurs : 0/3')).toBeVisible()
  })

  test('avertit avant la dernière erreur permise', async ({ page }) => {
    await mockSudokuApi(page)
    await startEasyGame(page)
    const target = EMPTY_CELLS[0]

    await fillCell(page, target, wrongDigitFor(target))
    await expect(page.getByText(/plus qu’une erreur permise/)).toHaveCount(0)
    await pad(page, wrongDigitFor(target)).click()

    await expect(page.getByText('Erreurs : 2/3')).toBeVisible()
    await expect(page.getByText(/plus qu’une erreur permise/)).toBeVisible()
  })

  test('la quatrième erreur perd la partie, sans score, et on peut rejouer', async ({ page }) => {
    const server = await mockSudokuApi(page)
    await startEasyGame(page)
    const target = EMPTY_CELLS[0]

    await fillCell(page, target, wrongDigitFor(target))
    for (let i = 0; i < 3; i++) await pad(page, wrongDigitFor(target)).click()

    await expect(page.getByText('Partie perdue : plus de 3 erreurs.')).toBeVisible()
    await expect(page.getByRole('group')).toHaveCount(0)
    expect(server.calls.checks).toBe(0)
    await expect(page.getByRole('button', { name: 'Reprendre ma partie' })).toHaveCount(0)

    await page.getByRole('button', { name: 'Facile' }).click()
    await expect(page.getByRole('group', { name: 'Grille de sudoku' })).toBeVisible()
    await expect(page.getByText('Erreurs : 0/3')).toBeVisible()
    expect(server.calls.puzzle).toBe(2)
  })

  test('une partie en cours se reprend après un rechargement de la page', async ({ page }) => {
    await mockSudokuApi(page)
    await startEasyGame(page)
    const [first, second] = EMPTY_CELLS
    await fillCell(page, first, SOLUTION[first])
    await fillCell(page, second, wrongDigitFor(second))

    await page.reload()
    await page.getByRole('button', { name: 'Reprendre ma partie' }).click()

    await expect(page.getByRole('group', { name: 'Grille de sudoku' })).toBeVisible()
    await expect(page.getByText('Erreurs : 1/3')).toBeVisible()
    await expect(cell(page, first)).toHaveAccessibleName(new RegExp(`${SOLUTION[first]}$`))
    await expect(page.getByText(/Temps : 0:4\d/)).toBeVisible()
  })

  test('une partie que le serveur a oubliée n’est plus reprise', async ({ page }) => {
    const server = await mockSudokuApi(page)
    await startEasyGame(page)
    server.expire()

    await page.reload()
    await page.getByRole('button', { name: 'Reprendre ma partie' }).click()

    await expect(page.getByText('Cette partie a expiré. Lance-en une nouvelle.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Reprendre ma partie' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Facile' })).toBeVisible()
  })

  test('l’écran de jeu est conforme WCAG 2.1 AA', async ({ page }) => {
    await mockSudokuApi(page)
    await startEasyGame(page)

    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    const blocking = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')

    expect(
      blocking.map((v) => `${v.id} (${v.impact}) : ${v.help} — ${v.nodes.map((n) => n.target).join(', ')}`),
    ).toEqual([])
  })
})
