import { expect, test } from '@playwright/test'
import { mockPlatform } from './fixtures'

const player = { id: '7c9e6679-7425-40de-944b-e07fc1f90ae7', email: 'joueur@example.com' }
const profile = { id: player.id, username: 'joueur_42', avatar_url: null, created_at: '', updated_at: '' }

test.describe('compte', () => {
  test('l’inscription propose Google et part vers le backend en revenant à l’accueil', async ({ page }) => {
    await mockPlatform(page)
    // La redirection réelle mène chez Google : on s'arrête à la requête du backend qui la démarre.
    const googleStart = page.waitForRequest('**/api/auth/google?**')
    await page.route('**/api/auth/google?**', (route) =>
      route.fulfill({ body: 'vers Google', contentType: 'text/plain' }),
    )
    await page.goto('/signup')

    await page.getByRole('button', { name: 'S’inscrire avec Google' }).click()

    expect(new URL((await googleStart).url()).searchParams.get('redirect')).toBe('/')
  })

  test('un joueur supprime son compte après avoir retapé son pseudo (RGPD)', async ({ page }) => {
    await mockPlatform(page)
    let signedIn = true
    await page.route('**/api/auth/session', (route) =>
      route.fulfill({
        json: signedIn ? { user: player, accessToken: 'jwt-e2e', expiresAt: Date.now() + 3_600_000 } : { user: null },
      }),
    )
    await page.route('https://supabase.e2e.test/rest/v1/profiles**', (route) => route.fulfill({ json: profile }))
    const deletion = page.waitForRequest((r) => r.url().endsWith('/api/auth/account') && r.method() === 'DELETE')
    await page.route('**/api/auth/account', (route) => {
      signedIn = false
      return route.fulfill({ status: 204 })
    })
    await page.goto('/profile')

    const button = page.getByRole('button', { name: 'Supprimer définitivement mon compte' })
    await expect(button).toBeDisabled()
    await page.getByLabel(/Pour confirmer, tape ton pseudo/).fill('joueur_42')
    await button.click()

    await deletion
    await expect(page).toHaveURL('/')
    await expect(page.getByRole('status')).toHaveText('Ton compte et toutes tes données ont été supprimés.')
    await expect(page.getByRole('heading', { name: 'Bienvenue sur Tiki Gaming' })).toBeVisible()
  })
})
