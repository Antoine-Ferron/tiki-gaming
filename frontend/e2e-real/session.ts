import { expect, type Page } from '@playwright/test'

/** Identité de jeu vérifiée auprès de Spring, indépendamment du chargement du profil du lobby. */
export async function loginAccount(page: Page, id: number) {
  const bootstrap = page.waitForResponse(
    (response) => response.url().endsWith('/api/auth/session') && response.status() === 200,
  )
  await page.goto('/login')
  await bootstrap
  await page.getByLabel('Email', { exact: true }).fill(`bang${id}@example.test`)
  await page.getByLabel('Mot de passe', { exact: true }).fill('bang-browser-test-only')
  const expectedId = `00000000-0000-4000-8000-00000000000${id}`
  const [login, session] = await Promise.all([
    page.waitForResponse(
      (response) => response.url().endsWith('/api/auth/login') && response.request().method() === 'POST',
    ),
    page.waitForResponse(
      async (response) =>
        response.url().endsWith('/api/auth/session') &&
        response.status() === 200 &&
        (await response.json()).user?.id === expectedId,
      { timeout: 30000 },
    ),
    page.getByRole('button', { name: 'Se connecter', exact: true }).click(),
  ])
  expect(login.status()).toBe(204)
  expect((await session.json()).user.id).toBe(expectedId)
  await expect(page.getByRole('button', { name: 'Déconnexion', exact: true })).toBeVisible()
}
