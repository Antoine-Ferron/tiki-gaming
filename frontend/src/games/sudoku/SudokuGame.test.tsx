// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { GameError } from '../errors'
import { createGameContext } from '../sdk'
import { FakeScores, fakeDeps } from '../testing/fakes'
import type { GameContext, Player } from '../types'
import SudokuGame from './SudokuGame'

// Grille résolue connue, avec une seule case vide : une partie se termine en un geste, sans dépendre de l'aléa.
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

vi.mock('./logic', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./logic')>()),
  generatePuzzle: () => ({ puzzle: [...PUZZLE], solution: [...SOLUTION] }),
}))

const RIGHT_DIGIT = SOLUTION[EMPTY_INDEX]
const WRONG_DIGIT = (RIGHT_DIGIT % 9) + 1
const player: Player = { id: 'p1', username: 'alice' }
const EMPTY_CELL = 'Ligne 5, colonne 5, vide'

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
const pad = (digit: number) => fireEvent.click(screen.getByRole('button', { name: String(digit) }))
const solve = async () => {
  selectEmptyCell()
  pad(RIGHT_DIGIT)
  await flush()
}

const savedGame = (seconds: number, mistakes: number) => ({
  difficulty: 'medium',
  puzzle: PUZZLE,
  solution: SOLUTION,
  values: PUZZLE,
  seconds,
  mistakes,
})

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  cleanup()
  vi.useRealTimers()
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
    await deps.saves.save('sudoku', savedGame(42, 2))
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

  test('compte une erreur et signale le conflit quand le chiffre est faux', async () => {
    await setup()
    await startEasy()

    selectEmptyCell()
    pad(WRONG_DIGIT)

    expect(screen.getByText('Erreurs : 1')).toBeTruthy()
    expect(document.querySelectorAll('.sudoku-conflict').length).toBeGreaterThan(0)
  })

  test('efface une case avec le bouton Effacer', async () => {
    await setup()
    await startEasy()
    selectEmptyCell()
    pad(WRONG_DIGIT)

    fireEvent.click(screen.getByRole('button', { name: 'Effacer la case' }))

    expect(screen.getByRole('button', { name: EMPTY_CELL })).toBeTruthy()
  })

  test('ne modifie pas un indice de départ', async () => {
    await setup()
    await startEasy()

    fireEvent.click(screen.getByRole('button', { name: /^Ligne 1, colonne 1, 5$/ }))
    pad(9)

    expect(screen.getByRole('button', { name: /^Ligne 1, colonne 1, 5$/ })).toBeTruthy()
    expect(screen.getByText('Erreurs : 0')).toBeTruthy()
  })

  test('se joue au clavier : chiffre, effacement et flèches', async () => {
    await setup()
    await startEasy()
    selectEmptyCell()
    const grid = screen.getByRole('grid', { name: 'Grille de sudoku' })

    fireEvent.keyDown(grid, { key: String(WRONG_DIGIT) })
    expect(screen.getByText('Erreurs : 1')).toBeTruthy()
    fireEvent.keyDown(grid, { key: 'Backspace' })
    expect(screen.getByRole('button', { name: EMPTY_CELL })).toBeTruthy()

    fireEvent.keyDown(grid, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /^Ligne 5, colonne 6, / }))
    fireEvent.keyDown(grid, { key: 'ArrowUp' })
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /^Ligne 4, colonne 6, / }))
  })

  test('ignore le clavier tant qu’aucune case n’est sélectionnée', async () => {
    await setup()
    await startEasy()

    fireEvent.keyDown(screen.getByRole('grid', { name: 'Grille de sudoku' }), { key: '5' })

    expect(screen.getByText('Erreurs : 0')).toBeTruthy()
  })

  test('sauvegarde la partie dès le départ', async () => {
    const { saves } = await setup()

    await startEasy()

    expect(saves.data.get('sudoku')).toMatchObject({ difficulty: 'easy', mistakes: 0 })
  })

  test('reprend une partie sauvegardée avec son chrono et ses erreurs', async () => {
    // Arrange
    const deps = fakeDeps()
    await deps.saves.save('sudoku', savedGame(42, 2))
    render(<SudokuGame ctx={createGameContext({ slug: 'sudoku' }, player, deps)} />)
    await flush()

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Reprendre ma partie' }))
    await flush()

    // Assert
    expect(screen.getByText('Temps : 0:42')).toBeTruthy()
    expect(screen.getByText('Erreurs : 2')).toBeTruthy()
  })
})

describe('fin de partie', () => {
  test('envoie le score au classement avec le détail de la partie', async () => {
    // Arrange
    const { scores } = await setup()
    await startEasy()
    await advance(3000)

    // Act
    await solve()

    // Assert : 1000 - 3 s, aucune erreur
    expect(scores.rows).toHaveLength(1)
    expect(scores.rows[0]).toMatchObject({
      gameSlug: 'sudoku',
      score: 997,
      metadata: { difficulty: 'easy', seconds: 3, mistakes: 0 },
    })
    expect(screen.getByText(/Bravo/).textContent).toContain('997')
  })

  test('efface la sauvegarde de la partie terminée', async () => {
    const { saves } = await setup()
    await startEasy()

    await solve()

    expect(saves.data.has('sudoku')).toBe(false)
    expect(screen.queryByRole('button', { name: 'Reprendre ma partie' })).toBeNull()
  })

  test('retire une erreur du score', async () => {
    const { scores } = await setup()
    await startEasy()
    selectEmptyCell()
    pad(WRONG_DIGIT)

    await solve()

    expect(scores.rows[0].score).toBe(1000 - 50)
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
