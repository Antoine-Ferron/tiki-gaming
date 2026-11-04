// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'vitest'
import { GameError, MESSAGES } from '../errors'
import { createGameContext } from '../sdk'
import { FakeScores, fakeDeps } from '../testing/fakes'
import type { Player } from '../types'
import type { GameState } from './domain/game'
import type { TileSpawner } from './domain/spawner'
import Game2048Game from './Game2048Game'

// Intégration : vrai composant, vrai domaine, vrai service et vrai SDK (file d'attente des scores comprise).
// Seuls le hasard (stub) et le stockage (fakes en mémoire, à la place de Supabase et du navigateur) sont remplacés.

const game = { slug: 'game-2048' }
const player: Player = { id: 'p1', username: 'evan' }

const stubSpawner: TileSpawner = {
  spawn(grid) {
    const next = grid.map((row) => [...row])
    const r = next.findIndex((row) => row.includes(0))
    if (r >= 0) next[r][next[r].indexOf(0)] = 2
    return next
  },
}

/** Un coup vers la gauche remplit la dernière case sans fusion possible : la partie est perdue. */
const almostLost: GameState = {
  grid: [
    [2, 4, 2, 4],
    [4, 2, 4, 2],
    [2, 4, 2, 4],
    [0, 4, 2, 4],
  ],
  score: 1500,
  moves: 200,
  status: 'playing',
  continued: false,
}

function open(deps: ReturnType<typeof fakeDeps>, who: Player | null, initialGame?: GameState) {
  const ctx = createGameContext(game, who, deps)
  return render(<Game2048Game ctx={ctx} spawner={stubSpawner} initialGame={initialGame} />)
}

const loseTheGame = () => fireEvent.keyDown(window, { key: 'ArrowLeft' })

afterEach(cleanup)

describe('2048 : parcours complets', () => {
  test('un joueur perd sa partie : il apparaît au classement, et son record est là quand il revient', async () => {
    // Arrange
    const scores = new FakeScores(player)
    const deps = fakeDeps({ scores })
    const view = open(deps, player, almostLost)

    // Act
    loseTheGame()

    // Assert
    expect(screen.getByText('Partie terminée')).toBeTruthy()
    const row = await screen.findByRole('listitem')
    expect(within(row).getByText('evan')).toBeTruthy()
    expect(within(row).getByText('1500')).toBeTruthy()
    expect(scores.rows).toEqual([
      expect.objectContaining({ gameSlug: 'game-2048', score: 1500, metadata: { maxTile: 4, moves: 201 } }),
    ])

    // Act : il ferme le jeu puis le rouvre
    view.unmount()
    open(deps, player)

    // Assert
    expect(await screen.findByText('Record : 1500')).toBeTruthy()
  })

  test('un score perdu pendant une coupure réseau part avec la partie suivante', async () => {
    // Arrange
    const scores = new FakeScores(player)
    const deps = fakeDeps({ scores })
    scores.failNext(new GameError('network', 'hors ligne'))
    open(deps, player, almostLost)

    // Act : la partie se termine pendant la coupure
    loseTheGame()

    // Assert
    expect(await screen.findByText(MESSAGES.queued)).toBeTruthy()
    expect(screen.getByText('Record : 1500')).toBeTruthy()
    expect(scores.rows).toEqual([])

    // Act : la connexion revient ; il joue une nouvelle partie et l'abandonne avec 4 points
    fireEvent.click(screen.getByRole('button', { name: 'Nouvelle partie' }))
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    fireEvent.click(screen.getByRole('button', { name: 'Nouvelle partie' }))

    // Assert : le score gardé sur l'appareil est envoyé avant le nouveau
    await waitFor(() => expect(scores.rows.map((r) => r.score)).toEqual([1500, 4]))
  })

  test('un invité garde son record d’une visite à l’autre, sans rien envoyer au classement', async () => {
    // Arrange
    const scores = new FakeScores(player)
    const deps = fakeDeps({ scores })
    const view = open(deps, null, almostLost)

    // Act
    loseTheGame()
    expect(await screen.findByText('Record : 1500')).toBeTruthy()
    view.unmount()
    open(deps, null)

    // Assert
    expect(await screen.findByText('Record : 1500')).toBeTruthy()
    expect(scores.rows).toEqual([])
  })
})
