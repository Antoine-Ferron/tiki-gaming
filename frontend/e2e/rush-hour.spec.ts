import { expect, type Page, test } from '@playwright/test'
import { mockPlatform } from './fixtures'

// Le glisser-déposer à la souris dans un vrai navigateur : jsdom ne calcule aucune mise en page, ce geste ne se
// teste qu'ici. Le calcul du glissé (bornes, arrondi) est couvert par les tests unitaires de components/drag.ts.

/** Glisse un véhicule de `cells` cases le long de son axe, avec des mouvements de souris intermédiaires. */
async function drag(page: Page, vehicle: string, cells: number) {
  const button = page.getByRole('button', { name: vehicle, exact: true })
  const box = (await button.boundingBox())!
  const board = (await page.getByRole('group', { name: 'Plateau Rush Hour' }).boundingBox())!
  const cell = board.width / 6
  const horizontal = box.width > box.height
  const [x, y] = [box.x + box.width / 2, box.y + box.height / 2]
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(horizontal ? x + cells * cell : x, horizontal ? y : y + cells * cell, { steps: 10 })
  await page.mouse.up()
}

test.describe('Rush Hour', () => {
  test.beforeEach(async ({ page }) => {
    await mockPlatform(page)
    await page.goto('/games/rush-hour')
    await page.getByRole('button', { name: /^Niveau 1\b/ }).click()
  })

  test('le niveau 1 se gagne à la souris, et la partie est vérifiée par le serveur', async ({ page }) => {
    // Arrange : le serveur de vérification accepte la partie
    const sent: unknown[] = []
    await page.route('**/api/games/rush-hour/levels/1/results', (route) => {
      sent.push(route.request().postDataJSON())
      return route.fulfill({ json: { score: 1000, moves: 3, optimal: 3 } })
    })

    // Act : la solution du contrat partagé (shared/games/rush-hour/contrat.json)
    await drag(page, 'Camion A, vertical', 3)
    await drag(page, 'Voiture H, vertical', -1)
    await drag(page, 'Voiture rouge', 3)

    // Assert
    await expect(page.getByText('Bravo ! 1000 points en 3 coups')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Voiture rouge', exact: true })).toBeDisabled()
    expect(sent).toEqual([
      {
        moves: [
          { vehicle: 'A', delta: 3 },
          { vehicle: 'H', delta: -1 },
          { vehicle: 'X', delta: 3 },
        ],
        hints: 0,
      },
    ])
  })

  test('un véhicule glissé trop loin s’arrête contre l’obstacle (R5)', async ({ page }) => {
    // Act : la voiture rouge n'a qu'une case libre devant elle (le camion A bloque la suite)
    await drag(page, 'Voiture rouge', 4)

    // Assert
    await expect(page.getByText('Coups : 1 (min. 3)')).toBeVisible()
  })

  test('un glissé de moins d’une demi-case n’est pas un coup', async ({ page }) => {
    // Act
    await drag(page, 'Voiture rouge', 0.4)

    // Assert
    await expect(page.getByText('Coups : 0 (min. 3)')).toBeVisible()
  })
})
