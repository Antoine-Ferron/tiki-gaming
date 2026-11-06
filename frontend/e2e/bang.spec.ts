import { expect, test } from '@playwright/test'
import { mockPlatform } from './fixtures'

// Partie locale à quatre, sans compte : le visiteur joue un tour complet sur le même écran.
test.describe('BANG ! (partie locale à quatre)', () => {
  test.beforeEach(async ({ page }) => {
    await mockPlatform(page)
  })

  test('un tour complet : piocher, défausser, finir le tour, puis passer l’écran au joueur suivant', async ({
    page,
  }) => {
    await page.goto('/games/bang')
    const hint = page.getByRole('status')
    const hand = page.getByRole('region', { name: 'Ta main' })

    await expect(page.getByRole('heading', { name: 'BANG !' })).toBeVisible()
    await expect(page.getByRole('region', { name: /Tapis de la place/ })).toHaveCount(4)
    await expect(hint).toHaveText('À toi de jouer : pioche tes deux cartes.')

    // Piocher : la main grossit de deux cartes et le jeu passe à l'étape de jeu.
    const before = await hand.getByRole('listitem').count()
    await page.getByRole('button', { name: 'Piocher' }).click()
    await expect(hand.getByRole('listitem')).toHaveCount(before + 2)
    await expect(hint).toHaveText('À toi de jouer : choisis un BANG ! et ta cible, ou termine ton tour.')

    // Finir le tour avec trop de cartes impose de défausser jusqu'au nombre de points de vie.
    await hand.getByRole('button', { name: 'Finir le tour' }).click()
    await expect(hint).toContainText('Tu as trop de cartes')
    while ((await hint.textContent())?.includes('trop de cartes')) {
      await hand.getByRole('listitem').getByRole('button').first().click()
    }
    await expect(hint).toHaveText('Tu as défaussé assez de cartes : finis ton tour.')

    // Le tour passe au joueur suivant : sa main reste cachée jusqu'à ce qu'il la demande.
    await hand.getByRole('button', { name: 'Finir le tour' }).click()
    await expect(hint).toHaveText(/Passe l'écran à la place \d/)
    await expect(hand).toHaveCount(0)
    await page.getByRole('button', { name: /Afficher la main de la place \d/ }).click()
    await expect(hint).toHaveText('À toi de jouer : pioche tes deux cartes.')
    await expect(hand).toBeVisible()
  })
})
