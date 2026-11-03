// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { ApiError, apiGet, apiPost } from '@/lib/api'
import { GameError } from '../errors'
import { createGameContext } from '../sdk'
import { FakeScores, fakeDeps } from '../testing/fakes'
import type { GameContext, Player } from '../types'
import SudokuGame from './SudokuGame'

vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  apiGet: vi.fn(),
  apiPost: vi.fn(),
}))

// Grille résolue connue, avec une seule case vide : la solution reste dans ce faux serveur, jamais dans le front.
const { SOLUTION, PUZZLE, EMPTY_INDEX } = vi.hoisted(() => {
  const rows = [
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
  const solution = rows.join('').split('').map(Number)
  const emptyIndex = 40
  return { SOLUTION: solution, PUZZLE: solution.map((n, i) => (i === emptyIndex ? 0 : n)), EMPTY_INDEX: emptyIndex }
})

const RIGHT_DIGIT = SOLUTION[EMPTY_INDEX]
const WRONG_DIGIT = (RIGHT_DIGIT % 9) + 1
const SERVER_SCORE = 2354
const player: Player = { id: 'p1', username: 'alice' }
const EMPTY_CELL = 'Ligne 5, colonne 5, vide'

/** Faux serveur : même contrat que /api/games/sudoku, état en mémoire. */
let mistakesOnServer: number
const fakeServer = () => {
  mistakesOnServer = 0
  vi.mocked(apiGet).mockImplementation(async (path: string) => {
    if (path === '/games/sudoku/g1') {
      return {
        gameId: 'g1',
        difficulty: 'medium',
        puzzle: PUZZLE,
        values: PUZZLE,
        mistakes: 2,
        seconds: 42,
      }
    }
    throw new ApiError(404, 'Partie introuvable ou expirée')
  })
  vi.mocked(apiPost).mockImplementation(async (path: string, body?: unknown) => {
    if (path === '/games/sudoku/g1/moves') {
      const { cell, value } = body as { cell: number; value: number }
      const correct = SOLUTION[cell] === value
      if (!correct) mistakesOnServer++
      return { correct, mistakes: mistakesOnServer, complete: correct }
    }
    if (path.startsWith('/games/sudoku?')) {
      return { gameId: 'g1', difficulty: new URL(path, 'http://x').searchParams.get('difficulty'), puzzle: PUZZLE }
    }
    if (path === '/games/sudoku/check') return { solved: true, score: SERVER_SCORE }
    throw new Error(`appel inattendu : ${path}`)
  })
}

const flush = () => act(async () => {})
const advance = (ms: number) => act(async () => void vi.advanceTimersByTime(ms))

const setup = async (opts: { guest?: boolean; scores?: FakeScores } = {}) => {
  const scores = opts.scores ?? new FakeScores(player)
  const deps = fakeDeps({ scores })
  const ctx: GameContext = createGameContext({ slug: 'sudoku' }, opts.guest ? null : player, deps)
  render(<SudokuGame ctx={ctx} />)
  await flush()
  return { ctx, scores, saves: deps.saves }
}

const startEasy = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Facile' }))
  await flush()
}
// La case libre se retrouve par sa position : une fois un chiffre posé, elle n'est plus « vide ».
const selectEmptyCell = () => fireEvent.click(screen.getByRole('button', { name: /^Ligne 5, colonne 5, / }))
const pad = async (digit: number) => {
  fireEvent.click(screen.getByRole('button', { name: String(digit) }))
  await flush()
}
const solve = async () => {
  selectEmptyCell()
  await pad(RIGHT_DIGIT)
}

beforeEach(() => {
  vi.useFakeTimers()
  fakeServer()
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.mocked(apiGet).mockReset()
  vi.mocked(apiPost).mockReset()
})

describe('menu', () => {
  test('propose les trois difficultés', async () => {
    await setup()

    for (const name of ['Facile', 'Moyen', 'Difficile']) {
      expect(screen.getByRole('button', { name })).toBeTruthy()
    }
  })

  test('affiche le classement et le meilleur score du joueur', async () => {
    // Arrange
    const scores = new FakeScores(player)
    await scores.insert('sudoku', 1200, {})

    // Act
    await setup({ scores })

    // Assert
    expect(screen.getByText('alice')).toBeTruthy()
    expect(screen.getByText('Ton meilleur score : 1200')).toBeTruthy()
  })

  test('propose de reprendre une partie sauvegardée', async () => {
    // Arrange
    const deps = fakeDeps()
    await deps.saves.save('sudoku', { gameId: 'g1' })
    const ctx = createGameContext({ slug: 'sudoku' }, player, deps)

    // Act
    render(<SudokuGame ctx={ctx} />)
    await flush()

    // Assert
    expect(screen.getByRole('button', { name: 'Reprendre ma partie' })).toBeTruthy()
  })

  test('n’affiche rien à reprendre sans sauvegarde', async () => {
    await setup()

    expect(screen.queryByRole('button', { name: 'Reprendre ma partie' })).toBeNull()
  })
})

describe('partie', () => {
  test('crée la partie sur le serveur avec la difficulté choisie', async () => {
    await setup()

    await startEasy()

    expect(apiPost).toHaveBeenCalledWith('/games/sudoku?difficulty=easy')
  })

  test('affiche la grille et un chrono qui avance sans attente réelle', async () => {
    // Arrange
    await setup()

    // Act
    await startEasy()
    await advance(3000)

    // Assert
    expect(screen.getByRole('grid', { name: 'Grille de sudoku' })).toBeTruthy()
    expect(screen.getByText('Temps : 0:03')).toBeTruthy()
  })

  test('refuse un chiffre faux : erreur comptée par le serveur, case laissée vide', async () => {
    await setup()
    await startEasy()

    selectEmptyCell()
    await pad(WRONG_DIGIT)

    expect(screen.getByText('Erreurs : 1')).toBeTruthy()
    expect(screen.getByRole('status').textContent).toContain('pas le bon')
    expect(screen.getByRole('button', { name: EMPTY_CELL })).toBeTruthy()
  })

  test('ne modifie pas un indice de départ et n’envoie aucune saisie', async () => {
    await setup()
    await startEasy()

    fireEvent.click(screen.getByRole('button', { name: /^Ligne 1, colonne 1, 5$/ }))
    await pad(9)

    expect(apiPost).not.toHaveBeenCalledWith(expect.stringContaining('/moves'), expect.anything())
    expect(screen.getByText('Erreurs : 0')).toBeTruthy()
  })

  test('se joue au clavier : chiffre et flèches', async () => {
    await setup()
    await startEasy()
    selectEmptyCell()
    const grid = screen.getByRole('grid', { name: 'Grille de sudoku' })

    fireEvent.keyDown(grid, { key: String(WRONG_DIGIT) })
    await flush()
    expect(screen.getByText('Erreurs : 1')).toBeTruthy()

    fireEvent.keyDown(grid, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /^Ligne 5, colonne 6, / }))
    fireEvent.keyDown(grid, { key: 'ArrowUp' })
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /^Ligne 4, colonne 6, / }))
  })

  test('ignore le clavier tant qu’aucune case n’est sélectionnée', async () => {
    await setup()
    await startEasy()

    fireEvent.keyDown(screen.getByRole('grid', { name: 'Grille de sudoku' }), { key: '5' })
    await flush()

    expect(apiPost).not.toHaveBeenCalledWith(expect.stringContaining('/moves'), expect.anything())
  })

  test('ne sauvegarde que l’identifiant de la partie, jamais la solution', async () => {
    const { saves } = await setup()

    await startEasy()

    expect(saves.data.get('sudoku')).toEqual({ gameId: 'g1' })
  })

  test('affiche l’erreur quand le serveur est injoignable au départ', async () => {
    vi.mocked(apiPost).mockRejectedValue(new ApiError(0, 'Le serveur est injoignable.'))
    await setup()

    await startEasy()

    expect(screen.getByText('Le serveur est injoignable.')).toBeTruthy()
    expect(screen.queryByRole('grid')).toBeNull()
  })

  test('reprend une partie depuis le serveur avec son chrono et ses erreurs', async () => {
    // Arrange
    const deps = fakeDeps()
    await deps.saves.save('sudoku', { gameId: 'g1' })
    render(<SudokuGame ctx={createGameContext({ slug: 'sudoku' }, player, deps)} />)
    await flush()

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Reprendre ma partie' }))
    await flush()

    // Assert
    expect(apiGet).toHaveBeenCalledWith('/games/sudoku/g1')
    expect(screen.getByText('Temps : 0:42')).toBeTruthy()
    expect(screen.getByText('Erreurs : 2')).toBeTruthy()
  })

  test('abandonne la sauvegarde d’une partie que le serveur ne connaît plus', async () => {
    // Arrange
    const deps = fakeDeps()
    await deps.saves.save('sudoku', { gameId: 'périmée' })
    vi.mocked(apiGet).mockRejectedValue(new ApiError(404, 'Partie introuvable ou expirée'))
    render(<SudokuGame ctx={createGameContext({ slug: 'sudoku' }, player, deps)} />)
    await flush()

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Reprendre ma partie' }))
    await flush()

    // Assert
    expect(screen.getByText('Cette partie a expiré. Lance-en une nouvelle.')).toBeTruthy()
    expect(deps.saves.data.has('sudoku')).toBe(false)
    expect(screen.queryByRole('button', { name: 'Reprendre ma partie' })).toBeNull()
  })

  test('affiche l’erreur d’un autre échec de reprise sans effacer la sauvegarde', async () => {
    const deps = fakeDeps()
    await deps.saves.save('sudoku', { gameId: 'g1' })
    vi.mocked(apiGet).mockRejectedValue(new ApiError(0, 'Le serveur est injoignable.'))
    render(<SudokuGame ctx={createGameContext({ slug: 'sudoku' }, player, deps)} />)
    await flush()

    fireEvent.click(screen.getByRole('button', { name: 'Reprendre ma partie' }))
    await flush()

    expect(screen.getByText('Le serveur est injoignable.')).toBeTruthy()
    expect(deps.saves.data.has('sudoku')).toBe(true)
  })
})

describe('fin de partie', () => {
  test('envoie au classement le score calculé par le serveur', async () => {
    // Arrange
    const { scores } = await setup()
    await startEasy()
    await advance(3000)

    // Act
    await solve()

    // Assert
    expect(apiPost).toHaveBeenCalledWith('/games/sudoku/check', { gameId: 'g1' })
    expect(scores.rows).toHaveLength(1)
    expect(scores.rows[0]).toMatchObject({
      gameSlug: 'sudoku',
      score: SERVER_SCORE,
      metadata: { difficulty: 'easy', seconds: 3, mistakes: 0 },
    })
    expect(screen.getByText(/Bravo/).textContent).toContain(String(SERVER_SCORE))
  })

  test('efface la sauvegarde de la partie terminée', async () => {
    const { saves } = await setup()
    await startEasy()

    await solve()

    expect(saves.data.has('sudoku')).toBe(false)
    expect(screen.queryByRole('button', { name: 'Reprendre ma partie' })).toBeNull()
  })

  test('affiche les erreurs comptées par le serveur', async () => {
    const { scores } = await setup()
    await startEasy()
    selectEmptyCell()
    await pad(WRONG_DIGIT)

    await solve()

    expect(scores.rows[0].metadata).toMatchObject({ mistakes: 1 })
    expect(screen.getByText(/1 erreur\./)).toBeTruthy()
  })

  test('met à jour le classement après l’envoi', async () => {
    await setup()
    await startEasy()

    await solve()

    expect(screen.getAllByText('alice').length).toBeGreaterThan(0)
  })

  test('invite un joueur invité à se connecter, sans rien envoyer', async () => {
    const { scores } = await setup({ guest: true })
    await startEasy()

    await solve()

    expect(screen.getByText('Connecte-toi pour apparaître au classement.')).toBeTruthy()
    expect(scores.rows).toHaveLength(0)
  })

  test('affiche l’erreur quand le score est refusé', async () => {
    // Arrange
    const scores = new FakeScores(player)
    scores.failNext(new GameError('invalid', 'Score refusé.'))
    await setup({ scores })
    await startEasy()

    // Act
    await solve()

    // Assert
    expect(screen.getByText('Score refusé.')).toBeTruthy()
  })

  test('permet de réessayer après l’échec d’une saisie', async () => {
    // Arrange
    await setup()
    await startEasy()
    vi.mocked(apiPost).mockRejectedValueOnce(new ApiError(404, 'Partie introuvable ou expirée'))
    selectEmptyCell()

    // Act
    await pad(RIGHT_DIGIT)
    await pad(RIGHT_DIGIT)

    // Assert
    expect(screen.getByText(/Bravo/)).toBeTruthy()
  })

  test('permet de rejouer et efface le résultat précédent', async () => {
    await setup()
    await startEasy()
    await solve()

    fireEvent.click(screen.getByRole('button', { name: 'Moyen' }))
    await flush()

    expect(screen.queryByText(/Bravo/)).toBeNull()
    expect(screen.getByRole('grid', { name: 'Grille de sudoku' })).toBeTruthy()
  })
})
