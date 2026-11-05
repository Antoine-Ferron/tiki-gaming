import { expect, type Page, test } from '@playwright/test'
import { mockPlatform } from './fixtures'

/**
 * Place les 5 navires à l'horizontale (orientation par défaut), un par ligne à partir de la colonne 1,
 * puis valide la flotte. Entièrement déterministe : contrairement à « Placer au hasard », on sait toujours
 * exactement où se trouve la flotte de chaque joueur, ce qui permet de viser des cases précises en bataille.
 */
async function placeFleet(page: Page) {
  for (let row = 1; row <= 5; row++) {
    await page.getByRole('button', { name: `Case ${row},1`, exact: true }).click()
  }
  await page.getByRole('button', { name: 'Prêt' }).click()
}

async function passDevice(page: Page) {
  await page.getByRole('button', { name: 'Je suis prêt' }).click()
}

/**
 * Lance une partie solo (même appareil) et place les deux flottes identiquement (voir `placeFleet`) :
 * Porte-avions lignes 1 cols 1-5, Croiseur ligne 2 cols 1-4, Contre-torpilleur ligne 3 cols 1-3,
 * Sous-marin ligne 4 cols 1-3, Torpilleur ligne 5 cols 1-2. Laisse la partie au tour du joueur 1.
 */
async function setupBattle(page: Page) {
  await page.getByRole('button', { name: 'Solo (même appareil)' }).click()
  await placeFleet(page)
  await passDevice(page)
  await placeFleet(page)
  await passDevice(page)
  await expect(page.getByRole('heading', { name: 'Au tour du joueur 1' })).toBeVisible()
}

test.describe('Bataille navale (solo, même appareil)', () => {
  test.beforeEach(async ({ page }) => {
    await mockPlatform(page)
    await page.goto('/games/bataille-navale')
  })

  test('affiche le menu et permet de lancer une partie solo sans connexion', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Bataille navale' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Solo (même appareil)' })).toBeVisible()

    await page.getByRole('button', { name: 'Solo (même appareil)' }).click()

    await expect(page.getByRole('heading', { name: 'Le joueur 1 place sa flotte' })).toBeVisible()
  })

  test('place sa flotte puis passe l’appareil au joueur suivant', async ({ page }) => {
    await page.getByRole('button', { name: 'Solo (même appareil)' }).click()
    await placeFleet(page)

    await expect(page.getByRole('heading', { name: "Passe l'appareil" })).toBeVisible()
    await expect(page.getByText("Passe l'appareil au joueur 2 pour qu'il place sa flotte.")).toBeVisible()

    await passDevice(page)

    await expect(page.getByRole('heading', { name: 'Le joueur 2 place sa flotte' })).toBeVisible()
  })

  test('un tir dans l’eau ne touche rien et passe la main', async ({ page }) => {
    await setupBattle(page)

    // Case hors de la flotte du joueur 2 (posée lignes 1 à 5, colonnes 1 à 5 au plus).
    await page.getByRole('button', { name: 'Case 10,10', exact: true }).click()

    await expect(page.getByRole('heading', { name: "Passe l'appareil" })).toBeVisible()
    await expect(page.getByText("À l'eau.")).toBeVisible()

    await passDevice(page)

    await expect(page.getByRole('heading', { name: 'Au tour du joueur 2' })).toBeVisible()
  })

  test('un tir qui touche fait rejouer, et couler un navire ne termine pas la partie', async ({ page }) => {
    await setupBattle(page)

    // Torpilleur du joueur 2 : ligne 5, colonnes 1 et 2.
    await page.getByRole('button', { name: 'Case 5,1', exact: true }).click()
    await expect(page.getByText('Touché !')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Au tour du joueur 1' })).toBeVisible()

    await page.getByRole('button', { name: 'Case 5,2', exact: true }).click()

    await expect(page.getByText('Torpilleur coulé !')).toBeVisible()
    await expect(page.getByText('Torpilleur (coulé)')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Au tour du joueur 1' })).toBeVisible()
  })

  test('couler toute la flotte adverse termine la partie et permet de rejouer', async ({ page }) => {
    await setupBattle(page)

    // Les 17 cases de la flotte du joueur 2, ship par ship, dans l'ordre de la flotte (voir `placeFleet`).
    const opponentFleetCells: Array<[row: number, col: number]> = [
      [1, 1],
      [1, 2],
      [1, 3],
      [1, 4],
      [1, 5], // Porte-avions (5)
      [2, 1],
      [2, 2],
      [2, 3],
      [2, 4], // Croiseur (4)
      [3, 1],
      [3, 2],
      [3, 3], // Contre-torpilleur (3)
      [4, 1],
      [4, 2],
      [4, 3], // Sous-marin (3)
      [5, 1],
      [5, 2], // Torpilleur (2)
    ]

    for (const [row, col] of opponentFleetCells) {
      await page.getByRole('button', { name: `Case ${row},${col}`, exact: true }).click()
    }

    await expect(page.getByRole('heading', { name: 'Le joueur 1 a gagné !' })).toBeVisible()
    await expect(page.getByText('17 tir(s) · 17 touché(s) · 100% de précision')).toBeVisible()

    await page.getByRole('button', { name: 'Rejouer' }).click()

    await expect(page.getByRole('heading', { name: 'Le joueur 1 place sa flotte' })).toBeVisible()
  })
})
