// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { GameContext } from '../types'
import { FakeRealtime } from '../testing/fakes'
import { coordKey, type PlacedShip } from './logic'
import BatailleNavaleGame from './BatailleNavaleGame'

// placeFleetRandomly et fireAndSubmitIfOver sont déjà exhaustivement testés en isolation dans
// logic.test.ts (placement déterministe, soumission du score). Ici, on les double pour ne tester
// que le câblage de l'interface : rendu des phases, passation, et réaction au résultat d'un tir.
const { placeFleetRandomly, fireAndSubmitIfOver } = vi.hoisted(() => ({
  placeFleetRandomly: vi.fn(),
  fireAndSubmitIfOver: vi.fn(),
}))

vi.mock('./logic', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./logic')>()
  return { ...actual, placeFleetRandomly, fireAndSubmitIfOver }
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const torpilleur: PlacedShip = {
  ship: { name: 'Torpilleur', size: 2 },
  coords: [
    { row: 0, col: 0 },
    { row: 0, col: 1 },
  ],
}

function buildCtx(overrides: Partial<GameContext> = {}): GameContext {
  return {
    gameSlug: 'bataille-navale',
    player: null,
    isGuest: true,
    submitScore: vi.fn().mockResolvedValue(true),
    getLeaderboard: vi.fn().mockResolvedValue([]),
    getMyBest: vi.fn().mockResolvedValue(null),
    loadSave: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockResolvedValue(undefined),
    clearSave: vi.fn().mockResolvedValue(undefined),
    realtime: new FakeRealtime(),
    ...overrides,
  }
}

function startGame(ctx = buildCtx()) {
  placeFleetRandomly.mockReturnValue([torpilleur])
  render(<BatailleNavaleGame ctx={ctx} />)
  fireEvent.click(screen.getByRole('button', { name: 'Nouvelle partie' }))
  return ctx
}

describe('BatailleNavaleGame', () => {
  test('écran de départ : propose de lancer une nouvelle partie', () => {
    render(<BatailleNavaleGame ctx={buildCtx()} />)

    expect(screen.getByRole('button', { name: 'Nouvelle partie' })).toBeTruthy()
  })

  test('lance une partie et affiche la grille de tir du joueur 1', () => {
    startGame()

    expect(screen.getByText('Au tour du joueur 1')).toBeTruthy()
    expect(screen.getAllByRole('button', { name: /^Case / })).toHaveLength(100)
  })

  test("un tir dans l'eau passe la main avec le message correspondant", async () => {
    fireAndSubmitIfOver.mockResolvedValue({ result: 'miss', gameOver: false })
    startGame()

    fireEvent.click(screen.getByRole('button', { name: 'Case 1,1' }))

    expect(await screen.findByText("À l'eau.")).toBeTruthy()
    expect(screen.getByText("Passe l'appareil au joueur 2")).toBeTruthy()
  })

  test('un tir qui coule un navire sans finir la partie affiche le navire coulé', async () => {
    fireAndSubmitIfOver.mockResolvedValue({ result: 'hit', sunk: torpilleur.ship, gameOver: false })
    startGame()

    fireEvent.click(screen.getByRole('button', { name: 'Case 1,1' }))

    expect(await screen.findByText('Torpilleur coulé !')).toBeTruthy()
  })

  test('après la passation, la grille affiche le tour du joueur suivant', async () => {
    fireAndSubmitIfOver.mockResolvedValue({ result: 'miss', gameOver: false })
    startGame()
    fireEvent.click(screen.getByRole('button', { name: 'Case 1,1' }))
    await screen.findByText("À l'eau.")

    fireEvent.click(screen.getByRole('button', { name: 'Je suis prêt' }))

    expect(screen.getByText('Au tour du joueur 2')).toBeTruthy()
  })

  test('couler le dernier navire adverse termine la partie, soumet le score et affiche le vainqueur', async () => {
    fireAndSubmitIfOver.mockImplementation(async (_fleet, _shots, _target, submitScore) => {
      await submitScore(1234, { shots: 1, hits: 1 })
      return { result: 'hit', sunk: torpilleur.ship, gameOver: true }
    })
    const ctx = startGame()

    fireEvent.click(screen.getByRole('button', { name: 'Case 1,1' }))

    expect(await screen.findByText('Le joueur 1 a gagné !')).toBeTruthy()
    expect(ctx.submitScore).toHaveBeenCalledWith(1234, { shots: 1, hits: 1, winner: 1 })
    expect(ctx.getLeaderboard).toHaveBeenCalled()
  })

  test('invité : incite à se connecter pour apparaître au classement après la victoire', async () => {
    fireAndSubmitIfOver.mockResolvedValue({ result: 'hit', gameOver: true })
    startGame(buildCtx({ isGuest: true }))

    fireEvent.click(screen.getByRole('button', { name: 'Case 1,1' }))

    expect(await screen.findByText(/Connecte-toi pour apparaître au classement/)).toBeTruthy()
  })

  test('connecté : aucune incitation à se connecter après la victoire', async () => {
    fireAndSubmitIfOver.mockResolvedValue({ result: 'hit', gameOver: true })
    startGame(buildCtx({ isGuest: false, player: { id: 'u1', username: 'alice' } }))

    fireEvent.click(screen.getByRole('button', { name: 'Case 1,1' }))

    await screen.findByText('Le joueur 1 a gagné !')
    expect(screen.queryByText(/Connecte-toi pour apparaître au classement/)).toBeNull()
  })

  test('affiche une erreur si la soumission du score échoue', async () => {
    fireAndSubmitIfOver.mockRejectedValue(new Error('boom'))
    startGame()

    fireEvent.click(screen.getByRole('button', { name: 'Case 1,1' }))

    expect(await screen.findByText('boom')).toBeTruthy()
  })

  test('un tir répété ne modifie ni la phase ni la grille', async () => {
    fireAndSubmitIfOver.mockResolvedValue({ result: 'repeat', gameOver: false })
    startGame()

    fireEvent.click(screen.getByRole('button', { name: 'Case 1,1' }))

    await Promise.resolve()
    expect(screen.getByText('Au tour du joueur 1')).toBeTruthy()
  })

  test("une erreur de chargement du classement n'empêche pas de continuer à jouer", async () => {
    const ctx = buildCtx({ getLeaderboard: vi.fn().mockRejectedValue(new Error('indisponible')) })
    render(<BatailleNavaleGame ctx={ctx} />)

    await vi.waitFor(() => expect(ctx.getLeaderboard).toHaveBeenCalled())
    expect(screen.getByRole('button', { name: 'Nouvelle partie' })).toBeTruthy()
  })

  test('au tour suivant du même joueur, ses tirs précédents restent marqués et désactivés', async () => {
    fireAndSubmitIfOver.mockImplementationOnce(async (_fleet, shots: Set<string>, target) => {
      shots.add(coordKey(target))
      return { result: 'hit', gameOver: false }
    })
    startGame()
    fireEvent.click(screen.getByRole('button', { name: 'Case 1,1' }))
    await screen.findByText('Touché !')
    fireEvent.click(screen.getByRole('button', { name: 'Je suis prêt' }))

    fireAndSubmitIfOver.mockImplementationOnce(async (_fleet, shots: Set<string>, target) => {
      shots.add(coordKey(target))
      return { result: 'miss', gameOver: false }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Case 2,2' }))
    await screen.findByText("À l'eau.")
    fireEvent.click(screen.getByRole('button', { name: 'Je suis prêt' }))

    expect(screen.getByText('Au tour du joueur 1')).toBeTruthy()
    const firstCell = screen.getByRole('button', { name: 'Case 1,1' })
    expect(firstCell).toHaveProperty('disabled', true)
    expect(firstCell.className).toContain('hit')
  })
})
