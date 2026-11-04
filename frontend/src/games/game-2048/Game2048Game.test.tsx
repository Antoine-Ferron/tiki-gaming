// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'vitest'
import { GameError, MESSAGES } from '../errors'
import { createGameContext } from '../sdk'
import { FakeScores, fakeDeps } from '../testing/fakes'
import type { GameState } from './domain/game'
import type { TileSpawner } from './domain/spawner'
import Game2048Game from './Game2048Game'

const game = { slug: 'game-2048' }
const player = { id: 'p1', username: 'evan' }

/** Stub : un 2 sur la première case vide, pour des grilles prévisibles. */
const stubSpawner: TileSpawner = {
  spawn(grid) {
    const next = grid.map((row) => [...row])
    const r = next.findIndex((row) => row.includes(0))
    if (r >= 0) next[r][next[r].indexOf(0)] = 2
    return next
  },
}

function playing(grid: number[][], score = 0): GameState {
  return { grid, score, moves: 0, status: 'playing', continued: false }
}

const almostWon = playing(
  [
    [1024, 1024, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  10000,
)

const almostLost = playing(
  [
    [2, 4, 2, 4],
    [4, 2, 4, 2],
    [2, 4, 2, 4],
    [0, 4, 2, 4],
  ],
  1500,
)

function setup({ guest = false, initialGame }: { guest?: boolean; initialGame?: GameState } = {}) {
  const scores = new FakeScores(player)
  const deps = fakeDeps({ scores })
  const ctx = createGameContext(game, guest ? null : player, deps)
  render(<Game2048Game ctx={ctx} spawner={stubSpawner} initialGame={initialGame} />)
  return { scores, deps }
}

const cells = () => screen.getAllByRole('gridcell').map((cell) => cell.textContent || '.')
const press = (key: string) => fireEvent.keyDown(window, { key })

afterEach(cleanup)

describe('Game2048Game', () => {
  test('affiche une grille de 16 cases avec les 2 tuiles de départ et un score à 0', async () => {
    // Act
    setup()

    // Assert
    expect(cells()).toEqual(['2', '2', ...Array(14).fill('.')])
    expect(screen.getAllByRole('gridcell', { name: 'vide' })).toHaveLength(14)
    expect(screen.getByText('Score : 0')).toBeTruthy()
    expect(await screen.findByText('Record : 0')).toBeTruthy()
  })

  test('une flèche joue un coup : les tuiles fusionnent et le score monte', () => {
    // Arrange
    setup()

    // Act
    press('ArrowLeft')

    // Assert
    expect(cells().slice(0, 4)).toEqual(['4', '2', '.', '.'])
    expect(screen.getByText('Score : 4')).toBeTruthy()
  })

  test('une touche qui ne joue pas ne change rien', () => {
    // Arrange
    setup()

    // Act
    press('Enter')

    // Assert
    expect(cells().slice(0, 4)).toEqual(['2', '2', '.', '.'])
    expect(screen.getByText('Score : 0')).toBeTruthy()
  })

  test('affiche le record sauvegardé', async () => {
    // Arrange
    const scores = new FakeScores(player)
    const deps = fakeDeps({ scores })
    deps.saves.data.set('game-2048', { version: 1, best: 3200 })

    // Act
    render(<Game2048Game ctx={createGameContext(game, player, deps)} spawner={stubSpawner} />)

    // Assert
    expect(await screen.findByText('Record : 3200')).toBeTruthy()
  })

  test('la tuile 2048 affiche la victoire, et Continuer permet de jouer encore', () => {
    // Arrange
    setup({ initialGame: almostWon })

    // Act
    press('ArrowLeft')

    // Assert
    expect(screen.getByText('Tu as gagné !')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }))
    expect(screen.queryByText('Tu as gagné !')).toBeNull()
    press('ArrowRight')
    expect(cells().slice(0, 4)).toEqual(['2', '.', '2048', '2'])
  })

  test('une défaite affiche la fin de partie, envoie le score et met à jour le record et le classement', async () => {
    // Arrange
    const { scores } = setup({ initialGame: almostLost })

    // Act : la case libérée se remplit avec un 2, sans fusion possible
    press('ArrowLeft')

    // Assert
    expect(screen.getByText('Partie terminée')).toBeTruthy()
    await waitFor(() => expect(scores.rows.map((r) => r.score)).toEqual([1500]))
    expect(await screen.findByText('Record : 1500')).toBeTruthy()
    expect(await screen.findByRole('listitem')).toBeTruthy()
  })

  test('Nouvelle partie en cours de jeu termine la partie et repart d’une grille neuve', async () => {
    // Arrange
    const { scores } = setup({ initialGame: playing(almostWon.grid, 300) })

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Nouvelle partie' }))

    // Assert
    await waitFor(() => expect(scores.rows.map((r) => r.score)).toEqual([300]))
    expect(cells()).toEqual(['2', '2', ...Array(14).fill('.')])
    expect(screen.getByText('Score : 0')).toBeTruthy()
  })

  test('Nouvelle partie avec un score à 0 n’envoie rien', async () => {
    // Arrange
    const { scores } = setup()

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Nouvelle partie' }))

    // Assert
    await waitFor(() => expect(screen.getByText('Score : 0')).toBeTruthy())
    expect(scores.rows).toEqual([])
  })

  test('invité : le jeu l’invite à se connecter pour être classé', () => {
    // Act
    setup({ guest: true })

    // Assert
    expect(screen.getByText('Connecte-toi pour apparaître au classement.')).toBeTruthy()
  })

  test('coupure réseau en fin de partie : le joueur est prévenu', async () => {
    // Arrange
    const { scores } = setup({ initialGame: almostLost })
    scores.failNext(new GameError('network', 'hors ligne'))

    // Act
    press('ArrowLeft')

    // Assert
    expect(await screen.findByText(MESSAGES.queued)).toBeTruthy()
  })
})
