import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import MastermindGame from './MastermindGame'
import type { GameContext } from '../types'
import { apiPost } from '@/lib/api'

vi.mock('@/lib/api', () => ({ apiPost: vi.fn() }))

const initialGame = {
  id: 'game-1',
  status: 'IN_PROGRESS',
  attemptsUsed: 0,
  attemptsRemaining: 10,
  history: [],
  secret: null,
  score: 0,
}

function createContext(): GameContext {
  return {
    gameSlug: 'mastermind',
    player: { id: 'player-1', username: 'Testeur' },
    isGuest: false,
    submitScore: vi.fn().mockResolvedValue(true),
    getLeaderboard: vi.fn().mockResolvedValue([]),
    getMyBest: vi.fn().mockResolvedValue(null),
    loadSave: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockResolvedValue(undefined),
    clearSave: vi.fn().mockResolvedValue(undefined),
  }
}

function mockApi() {
  vi.mocked(apiPost).mockImplementation(async (path, body) => {
    if (path === '/games') return initialGame
    if (path === '/games/game-1/restart') return initialGame
    return {
      ...initialGame,
      status: 'WON',
      attemptsUsed: 1,
      attemptsRemaining: 9,
      history: [{ guess: (body as { colors: string[] }).colors, feedback: { exact: 4, misplaced: 0 } }],
      secret: ['red', 'blue', 'green', 'yellow'],
      score: 10,
    }
  })
}

describe('MastermindGame', () => {
  it('displays the six colors and ten attempts at the start', async () => {
    mockApi()
    render(<MastermindGame ctx={createContext()} />)

    expect(await screen.findByText('10 tentatives restantes')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Rouge' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Violet' })).toBeInTheDocument()
  })

  it('places selected colors in the current proposal', async () => {
    mockApi()
    const user = userEvent.setup()
    render(<MastermindGame ctx={createContext()} />)

    await screen.findByText('10 tentatives restantes')
    await user.click(screen.getByRole('button', { name: 'Rouge' }))
    expect(screen.getByRole('button', { name: 'Rouge, cliquer pour modifier' })).toBeInTheDocument()
  })

  it('keeps validation disabled until four colors are selected', async () => {
    mockApi()
    const user = userEvent.setup()
    render(<MastermindGame ctx={createContext()} />)
    await screen.findByText('10 tentatives restantes')
    const submit = screen.getByRole('button', { name: 'Valider la combinaison' })

    expect(submit).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Rouge' }))
    expect(submit).toBeDisabled()
  })

  it('sends the proposal to Java and displays the server result', async () => {
    mockApi()
    const ctx = createContext()
    const user = userEvent.setup()
    render(<MastermindGame ctx={ctx} />)
    await screen.findByText('10 tentatives restantes')

    for (let index = 0; index < 4; index++) await user.click(screen.getByRole('button', { name: 'Rouge' }))
    await user.click(screen.getByRole('button', { name: 'Valider la combinaison' }))

    expect(await screen.findByText('Bravo, combinaison trouvée !')).toBeInTheDocument()
    expect(apiPost).toHaveBeenCalledWith('/games/game-1/guesses', { colors: ['red', 'red', 'red', 'red'] })
    expect(ctx.submitScore).toHaveBeenCalledWith(10, { attempts: 1 })
  })

  it('shows the points rule in the accessible information tooltip', async () => {
    mockApi()
    render(<MastermindGame ctx={createContext()} />)

    expect(await screen.findByRole('img', { name: 'Règle de calcul des points' })).toHaveAttribute(
      'data-tooltip',
      expect.stringContaining('Score = 11'),
    )
  })
})
