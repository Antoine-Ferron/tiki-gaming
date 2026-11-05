import AxeBuilder from '@axe-core/playwright'
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

/** Joue la solution du niveau 1 au clavier seul : Tab jusqu'au véhicule (ici, focus direct), puis les flèches. */
async function playLevel1WithKeyboard(page: Page) {
  for (const [vehicle, key, times] of [
    ['Camion A, vertical', 'ArrowDown', 3],
    ['Voiture H, vertical', 'ArrowUp', 1],
    ['Voiture rouge', 'ArrowRight', 3],
  ] as const) {
    await page.getByRole('button', { name: vehicle, exact: true }).focus()
    for (let i = 0; i < times; i++) await page.keyboard.press(key)
  }
}

/** Le serveur de vérification répond `status` avec `json` (et garde ce qu'il a reçu). */
async function serverAnswers(page: Page, status: number, json: object) {
  const sent: { hints: number }[] = []
  await page.route('**/api/games/rush-hour/levels/*/results', (route) => {
    sent.push(route.request().postDataJSON())
    return route.fulfill({ status, json })
  })
  return sent
}

// Les parcours critiques d'un joueur, de bout en bout. Les cas limites de calcul restent en tests unitaires.
test.describe('Rush Hour : parcours du joueur', () => {
  test.beforeEach(async ({ page }) => {
    await mockPlatform(page)
    await page.goto('/games/rush-hour')
  })

  test('gagner le niveau 1 ouvre le niveau 2, et la progression survit au rechargement', async ({ page }) => {
    // Arrange
    await serverAnswers(page, 200, { score: 1000, moves: 3, optimal: 3 })
    await expect(page.getByRole('button', { name: /^Niveau 2\b/ })).toBeDisabled()
    await page.getByRole('button', { name: /^Niveau 1\b/ }).click()

    // Act
    await playLevel1WithKeyboard(page)
    await expect(page.getByText('Bravo ! 1000 points en 3 coups')).toBeVisible()
    await page.reload()

    // Assert
    await expect(page.getByRole('button', { name: /^Niveau 2\b/ })).toBeEnabled()
    await expect(page.getByText('Score total : 1000 points')).toBeVisible()
  })

  test('le niveau 1 se gagne au clavier seul (accessibilité)', async ({ page }) => {
    // Arrange
    await serverAnswers(page, 200, { score: 1000, moves: 3, optimal: 3 })
    await page.getByRole('button', { name: /^Niveau 1\b/ }).click()

    // Act
    await playLevel1WithKeyboard(page)

    // Assert
    await expect(page.getByText('Bravo ! 1000 points en 3 coups')).toBeVisible()
  })

  test('un indice montre le coup à jouer, et le serveur reçoit l’indice utilisé', async ({ page }) => {
    // Arrange
    const sent = await serverAnswers(page, 200, { score: 800, moves: 3, optimal: 3 })
    await page.getByRole('button', { name: /^Niveau 1\b/ }).click()

    // Act
    await page.getByRole('button', { name: 'Indice (−200 points)' }).click()
    await expect(page.getByText('Indice : Camion A, vertical de 3 cases vers le bas')).toBeVisible()
    await playLevel1WithKeyboard(page)

    // Assert
    await expect(page.getByText('Bravo ! 800 points en 3 coups')).toBeVisible()
    expect(sent.map((body) => body.hints)).toEqual([1])
  })

  test('une partie refusée par le serveur affiche le refus, sans score', async ({ page }) => {
    // Arrange : le serveur rejoue la partie et la refuse
    await serverAnswers(page, 422, { error: 'Partie refusée : Déplacement impossible : X de 3' })
    await page.getByRole('button', { name: /^Niveau 1\b/ }).click()

    // Act
    await playLevel1WithKeyboard(page)

    // Assert
    await expect(page.getByText('Partie refusée : Déplacement impossible : X de 3')).toBeVisible()
    await expect(page.getByText(/^Bravo/)).toHaveCount(0)
  })

  test('trop de parties envoyées : le joueur voit le message du serveur (429)', async ({ page }) => {
    // Arrange
    await serverAnswers(page, 429, { error: 'Trop de parties envoyées : réessaie dans une minute.' })
    await page.getByRole('button', { name: /^Niveau 1\b/ }).click()

    // Act
    await playLevel1WithKeyboard(page)

    // Assert
    await expect(page.getByText('Trop de parties envoyées : réessaie dans une minute.')).toBeVisible()
  })

  test('un plateau généré en Facile se joue, avec un minimum de 3 à 8 coups', async ({ page }) => {
    // Act
    await page.getByRole('button', { name: 'Facile', exact: true }).click()

    // Assert
    await expect(page.getByText(/^Coups : 0 \(min\. [3-8]\)$/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Voiture rouge', exact: true })).toBeEnabled()
  })
})

/** Les violations WCAG 2.1 AA sérieuses ou critiques relevées par axe sur la page affichée. */
async function blockingA11yViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  return violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id} : ${v.help}`)
}

/** Le serveur rejoue la partie : 1000 points sans indice, 200 de moins par indice. */
async function serverScoresByHints(page: Page) {
  await page.route('**/api/games/rush-hour/levels/*/results', (route) => {
    const { hints } = route.request().postDataJSON() as { hints: number }
    return route.fulfill({ json: { score: 1000 - 200 * hints, moves: 3, optimal: 3 } })
  })
}

test.describe('Rush Hour : écrans, génération et classement', () => {
  test('Annuler retire le dernier coup, Recommencer remet le plateau de départ', async ({ page }) => {
    // Arrange
    await mockPlatform(page)
    await page.goto('/games/rush-hour')
    await page.getByRole('button', { name: /^Niveau 1\b/ }).click()
    await expect(page.getByRole('button', { name: 'Annuler' })).toBeDisabled()
    await page.getByRole('button', { name: 'Camion A, vertical', exact: true }).focus()
    await page.keyboard.press('ArrowDown')

    // Act + Assert : annuler
    await expect(page.getByText('Coups : 1 (min. 3)')).toBeVisible()
    await page.getByRole('button', { name: 'Annuler' }).click()
    await expect(page.getByText('Coups : 0 (min. 3)')).toBeVisible()

    // Act + Assert : recommencer après deux coups
    await page.getByRole('button', { name: 'Camion A, vertical', exact: true }).focus()
    await page.keyboard.press('ArrowDown')
    await page.getByRole('button', { name: 'Voiture rouge', exact: true }).focus()
    await page.keyboard.press('ArrowRight')
    await expect(page.getByText('Coups : 2 (min. 3)')).toBeVisible()
    await page.getByRole('button', { name: 'Recommencer' }).click()
    await expect(page.getByText('Coups : 0 (min. 3)')).toBeVisible()
  })

  test('après une victoire, « Niveau suivant » lance le niveau 2', async ({ page }) => {
    // Arrange
    await mockPlatform(page)
    await serverScoresByHints(page)
    await page.goto('/games/rush-hour')
    await page.getByRole('button', { name: /^Niveau 1\b/ }).click()
    await playLevel1WithKeyboard(page)

    // Act
    await page.getByRole('button', { name: 'Niveau suivant' }).click()

    // Assert
    await expect(page.getByRole('heading', { name: 'Niveau 2' })).toBeVisible()
    await expect(page.getByText(/^Coups : 0 \(min\. \d+\)$/)).toBeVisible()
  })

  test('rejouer un niveau moins bien ne fait pas baisser le record', async ({ page }) => {
    // Arrange : un premier passage à 1000 points
    await mockPlatform(page)
    await serverScoresByHints(page)
    await page.goto('/games/rush-hour')
    await page.getByRole('button', { name: /^Niveau 1\b/ }).click()
    await playLevel1WithKeyboard(page)
    await expect(page.getByText('Bravo ! 1000 points en 3 coups')).toBeVisible()

    // Act : un second passage avec un indice (800 points)
    await page.getByRole('button', { name: 'Rejouer' }).click()
    await page.getByRole('button', { name: 'Indice (−200 points)' }).click()
    await playLevel1WithKeyboard(page)
    await expect(page.getByText('Bravo ! 800 points en 3 coups')).toBeVisible()
    await page.getByRole('button', { name: '← Niveaux' }).click()

    // Assert
    await expect(page.getByRole('button', { name: /^Niveau 1\s*, 1000 points/ })).toBeVisible()
    await expect(page.getByText('Score total : 1000 points')).toBeVisible()
  })

  for (const { difficulty, minimum } of [
    { difficulty: 'Moyen', minimum: /^Coups : 0 \(min\. (9|1[0-6])\)$/ },
    { difficulty: 'Difficile', minimum: /^Coups : 0 \(min\. (1[7-9]|[2-9]\d)\)$/ },
  ]) {
    test(`un plateau généré en ${difficulty} a le minimum de coups de sa difficulté`, async ({ page }) => {
      // Arrange
      await mockPlatform(page)
      await page.goto('/games/rush-hour')

      // Act
      await page.getByRole('button', { name: difficulty, exact: true }).click()

      // Assert
      await expect(page.getByText(minimum)).toBeVisible()
    })
  }

  test('le classement des joueurs s’affiche à côté du jeu', async ({ page }) => {
    // Arrange
    await mockPlatform(page, [
      { user_id: 'a', username: 'alice', best_score: 15000 },
      { user_id: 'b', username: 'bob', best_score: 9000 },
    ])

    // Act
    await page.goto('/games/rush-hour')

    // Assert
    await expect(page.getByRole('heading', { name: 'Classement' })).toBeVisible()
    await expect(page.getByText('alice')).toBeVisible()
    await expect(page.getByText('15000')).toBeVisible()
  })

  test('serveur en panne : un message lisible, et les niveaux restent jouables', async ({ page }) => {
    // Arrange : le classement (Supabase) répond 502
    await mockPlatform(page, { status: 502 })

    // Act
    await page.goto('/games/rush-hour')

    // Assert
    await expect(page.getByText('Le serveur est injoignable. Vérifie ta connexion et réessaie.')).toBeVisible()
    await expect(page.getByRole('button', { name: /^Niveau 1\b/ })).toBeEnabled()
  })

  test('aucune violation d’accessibilité pendant une partie, ni sur l’écran de victoire', async ({ page }) => {
    // Arrange
    await mockPlatform(page)
    await serverScoresByHints(page)
    await page.goto('/games/rush-hour')
    await page.getByRole('button', { name: /^Niveau 1\b/ }).click()

    // Act + Assert : pendant la partie
    await expect(page.getByText('Coups : 0 (min. 3)')).toBeVisible()
    expect(await blockingA11yViolations(page)).toEqual([])

    // Act + Assert : écran de victoire
    await playLevel1WithKeyboard(page)
    await expect(page.getByText('Bravo ! 1000 points en 3 coups')).toBeVisible()
    expect(await blockingA11yViolations(page)).toEqual([])
  })
})

test.describe('Rush Hour : sur téléphone', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('le plateau tient dans l’écran et le niveau 1 se gagne au glisser-déposer', async ({ page }) => {
    // Arrange
    await mockPlatform(page)
    await serverScoresByHints(page)
    await page.goto('/games/rush-hour')
    await page.getByRole('button', { name: /^Niveau 1\b/ }).click()

    // Act
    const board = (await page.getByRole('group', { name: 'Plateau Rush Hour' }).boundingBox())!
    await drag(page, 'Camion A, vertical', 3)
    await drag(page, 'Voiture H, vertical', -1)
    await drag(page, 'Voiture rouge', 3)

    // Assert
    expect(board.x).toBeGreaterThanOrEqual(0)
    expect(board.x + board.width).toBeLessThanOrEqual(375)
    await expect(page.getByText('Bravo ! 1000 points en 3 coups')).toBeVisible()
  })
})
