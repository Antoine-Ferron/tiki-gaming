import { expect, test, type Page } from '@playwright/test'
import { mockPlatform } from './fixtures'
import { createGrid, type Rng } from '../src/games/demineur/logic'

/**
 * PRNG déterministe (mulberry32), identique des deux côtés : injecté dans le navigateur (remplace
 * Math.random avant que l'app ne charge) et rejoué ici côté Node pour connaître à l'avance la
 * grille réelle — sans ça, impossible de cliquer une mine précise dans un vrai navigateur.
 */
function seededRng(seed: number): Rng {
  let state = seed
  return {
    next() {
      state |= 0
      state = (state + 0x6d2b79f5) | 0
      let t = Math.imul(state ^ (state >>> 15), 1 | state)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    },
  }
}

async function installSeededRandom(page: Page, seed: number) {
  await page.addInitScript((seed) => {
    let state = seed
    Math.random = () => {
      state |= 0
      state = (state + 0x6d2b79f5) | 0
      let t = Math.imul(state ^ (state >>> 15), 1 | state)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }, seed)
}

function cellButton(page: Page, row: number, col: number) {
  return page.getByRole('button', { name: `Case ${row + 1}, ${col + 1}`, exact: true })
}

test.describe('démineur en invité', () => {
  test('de l’accueil à la grille débutant', async ({ page }) => {
    await mockPlatform(page)
    await page.goto('/')

    await page.getByRole('link', { name: /Démineur/ }).click()

    await expect(page).toHaveURL('/games/demineur')
    await expect(page.getByText('Tu joues en invité')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Débutant (9×9, 10 mines)' })).toBeDisabled()
    await expect(page.getByRole('button', { name: /^Case \d+, \d+$/ })).toHaveCount(81)
  })

  test('changer de difficulté redimensionne la grille', async ({ page }) => {
    await mockPlatform(page)
    await page.goto('/games/demineur')

    await page.getByRole('button', { name: 'Intermédiaire (16×16, 40 mines)' }).click()

    await expect(page.getByRole('button', { name: /^Case \d+, \d+$/ })).toHaveCount(256)
  })

  test('un clic gauche révèle une case', async ({ page }) => {
    await mockPlatform(page)
    await page.goto('/games/demineur')

    const cell = cellButton(page, 0, 0)
    await cell.click()

    await expect(cell).toBeDisabled()
  })

  test('un clic droit pose puis retire un drapeau', async ({ page }) => {
    await mockPlatform(page)
    await page.goto('/games/demineur')

    const cell = cellButton(page, 4, 4)
    await cell.click({ button: 'right' })

    await expect(cell).toHaveText('🚩')
    await expect(cell).toBeEnabled()

    await cell.click({ button: 'right' })

    await expect(cell).toHaveText('')
  })

  test('révéler une mine termine la partie en défaite', async ({ page }) => {
    const seed = 1
    const reference = createGrid(9, 9, 10, seededRng(seed))
    const mine = (() => {
      for (let row = 0; row < 9; row++)
        for (let col = 0; col < 9; col++) if (reference[row][col].mine) return { row, col }
      throw new Error('Aucune mine trouvée')
    })()

    await mockPlatform(page)
    await installSeededRandom(page, seed)
    await page.goto('/games/demineur')

    await cellButton(page, mine.row, mine.col).click()

    await expect(page.getByText('Perdu', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Case \d+, \d+$/ }).first()).toBeDisabled()
  })
})
