import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { mockPlatform } from './fixtures'

// Parcours vitaux de l'accueil de MiniGTA dans un vrai navigateur (3 moteurs). La partie elle-même (WebGL, physique,
// police, missions) est couverte plus bas dans la pyramide : simulations du harnais, scénarios BDD et API.

const SAVE_KEY = 'tiki:guest-save:mini-gta'
const save = {
  version: 1,
  money: 2400,
  totalEarned: 3300,
  armor: 0,
  inventory: null,
  completedMissions: ['express', 'chase'],
  stats: { kills: 0, wantedMax: 0, playTime: 120 },
}

test.describe('MiniGTA : accueil', () => {
  test('un invité sans sauvegarde peut lancer une nouvelle partie et est invité à se connecter', async ({ page }) => {
    await mockPlatform(page, [{ user_id: 'u1', username: 'alice', best_score: 4300 }])

    await page.goto('/games/mini-gta')

    await expect(page.getByRole('button', { name: 'Jouer' })).toBeVisible()
    await expect(page.getByText('Connecte-toi pour apparaître au classement.')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Classement' })).toBeVisible()
    await expect(page.getByText('alice')).toBeVisible()
  })

  test('une sauvegarde invitée est reprise : argent, gains, missions et « Continuer »', async ({ page }) => {
    await mockPlatform(page)
    await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [SAVE_KEY, JSON.stringify(save)])

    await page.goto('/games/mini-gta')

    await expect(page.getByRole('button', { name: 'Continuer' })).toBeVisible()
    const progress = page.locator('.mini-gta-save')
    await expect(progress).toContainText('2 400 $')
    await expect(progress).toContainText('3 300 $')
    await expect(progress).toContainText('2 / 4')
  })

  test('une sauvegarde corrompue donne une nouvelle partie au lieu d’une erreur', async ({ page }) => {
    await mockPlatform(page)
    await page.addInitScript(
      ([key, value]) => localStorage.setItem(key, value),
      [SAVE_KEY, JSON.stringify({ ...save, money: -50 })],
    )

    await page.goto('/games/mini-gta')

    await expect(page.getByRole('button', { name: 'Jouer' })).toBeVisible()
    await expect(page.locator('.mini-gta-save')).toHaveCount(0)
  })

  // 502 plutôt que 503 : postgrest-js retente lui-même les 503 pendant plusieurs secondes.
  test('classement indisponible : un message lisible, et la partie reste jouable', async ({ page }) => {
    await mockPlatform(page, { status: 502 })

    await page.goto('/games/mini-gta')

    await expect(page.getByText('Le serveur est injoignable. Vérifie ta connexion et réessaie.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Jouer' })).toBeEnabled()
  })

  test('aucune violation d’accessibilité sérieuse sur l’accueil', async ({ page }) => {
    await mockPlatform(page)
    await page.goto('/games/mini-gta')
    await expect(page.getByRole('button', { name: 'Jouer' })).toBeVisible()

    const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()

    expect(violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([])
  })
})

test.describe('MiniGTA : écran trop étroit', () => {
  test.use({ viewport: { width: 340, height: 700 } })

  test('sous 360 px, le jeu explique qu’il se joue sur ordinateur au lieu de proposer « Jouer »', async ({ page }) => {
    await mockPlatform(page)

    await page.goto('/games/mini-gta')

    await expect(page.getByText('Ce jeu se joue au clavier et à la souris, sur ordinateur.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Jouer' })).toHaveCount(0)
  })
})
