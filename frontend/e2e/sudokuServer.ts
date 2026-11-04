import type { Page } from '@playwright/test'

// Grille résolue connue et trois cases vides : une partie se joue en quelques clics, et la solution reste
// dans ce faux serveur, jamais dans le front (comme le vrai backend).
const ROWS = [
  '534678912',
  '672195348',
  '198342567',
  '859761423',
  '426853791',
  '713924856',
  '961537284',
  '287419635',
  '345286179',
]
export const SOLUTION = ROWS.join('').split('').map(Number)
export const EMPTY_CELLS = [4, 40, 76] as const
export const PUZZLE = SOLUTION.map((n, i) => ((EMPTY_CELLS as readonly number[]).includes(i) ? 0 : n))
export const GAME_ID = 'e2e-sudoku-game'
export const MAX_MISTAKES = 3
export const SERVER_SCORE = 2354

/** Une valeur fausse pour la case donnée. */
export const wrongDigitFor = (cell: number) => (SOLUTION[cell] % 9) + 1

export type SudokuCalls = { puzzle: number; moves: number; checks: number }

/**
 * Simule /api/games/sudoku avec le contrat du vrai backend : GET /puzzle, GET /{id}, POST /{id}/moves et
 * POST /check. L'état (grille du joueur, erreurs) vit dans le faux serveur et survit à un rechargement de page.
 */
export async function mockSudokuApi(page: Page) {
  const calls: SudokuCalls = { puzzle: 0, moves: 0, checks: 0 }
  const game = { values: [...PUZZLE], mistakes: 0, expired: false }
  const lost = () => game.mistakes > MAX_MISTAKES

  await page.route('**/api/games/sudoku/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname.replace('/api/games/sudoku/', '')
    const method = request.method()

    if (method === 'GET' && path === 'puzzle') {
      calls.puzzle++
      game.values = [...PUZZLE]
      game.mistakes = 0
      game.expired = false
      return route.fulfill({
        json: { gameId: GAME_ID, difficulty: url.searchParams.get('difficulty'), puzzle: PUZZLE },
      })
    }
    if (method === 'GET' && path === GAME_ID) {
      if (game.expired) return route.fulfill({ status: 400, json: { error: 'Partie inconnue ou expirée' } })
      return route.fulfill({
        json: {
          gameId: GAME_ID,
          difficulty: 'easy',
          puzzle: PUZZLE,
          values: game.values,
          mistakes: game.mistakes,
          maxMistakes: MAX_MISTAKES,
          lost: lost(),
          seconds: 42,
        },
      })
    }
    if (method === 'POST' && path === `${GAME_ID}/moves`) {
      calls.moves++
      if (lost()) return route.fulfill({ status: 409, json: { error: 'Partie perdue : trop d’erreurs.' } })
      const { cell, value } = request.postDataJSON() as { cell: number; value: number }
      const correct = SOLUTION[cell] === value
      if (correct) game.values[cell] = value
      else game.mistakes++
      return route.fulfill({
        json: { correct, mistakes: game.mistakes, complete: game.values.every((v) => v !== 0), lost: lost() },
      })
    }
    if (method === 'POST' && path === 'check') {
      calls.checks++
      if (lost()) return route.fulfill({ status: 409, json: { error: 'Partie perdue : trop d’erreurs.' } })
      const solved = game.values.every((v, i) => v === SOLUTION[i])
      return route.fulfill({ json: { complete: solved, solved, conflicts: [], score: solved ? SERVER_SCORE : 0 } })
    }
    return route.fulfill({ status: 404, json: { error: 'Route inconnue du faux serveur' } })
  })

  return {
    calls,
    /** Le serveur « oublie » la partie (expiration, redémarrage). */
    expire: () => {
      game.expired = true
    },
  }
}
