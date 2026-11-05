import { expect, type Page } from '@playwright/test'

/** Identité de jeu vérifiée auprès de Spring, indépendamment du chargement du profil du lobby. */
export async function loginAccount(page: Page, id: number) {
  await page.goto('/login')
  await page.getByLabel('Email', { exact: true }).fill(`bang${id}@example.test`)
  await page.getByLabel('Mot de passe', { exact: true }).fill('bang-browser-test-only')
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click()
  await expect
    .poll(async () => {
      const response = await page.request.get('/api/auth/session')
      expect(response.status()).toBe(200)
      return (await response.json()).user?.id
    })
    .toBe(`00000000-0000-4000-8000-00000000000${id}`)
  await expect(page.getByRole('button', { name: 'Déconnexion', exact: true })).toBeVisible()
}
