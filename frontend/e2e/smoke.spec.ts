import { expect, test } from '@playwright/test'
import { mockPlatform } from './fixtures'

/**
 * Smoke test (test de fumée) : un unique parcours critique minimal, exécutable seul et rapidement
 * après un déploiement — pas une régression complète (voir demineur.spec.ts pour ça). Si ce test
 * échoue, l'application n'est pas utilisable : rollback immédiat, pas d'investigation manuelle.
 */
test('démineur : parcours critique (accueil → grille jouable)', async ({ page }) => {
  await mockPlatform(page)

  await page.goto('/')
  await page.getByRole('link', { name: /Démineur/ }).click()
  await expect(page).toHaveURL('/games/demineur')

  const cell = page.getByRole('button', { name: 'Case 1, 1' })
  await cell.click()
  await expect(cell).toBeDisabled()
})
