// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, test } from 'vitest'
import { createGameContext } from '../sdk'
import { FakeScores, fakeDeps } from '../testing/fakes'
import { vehicleLabel } from './components/vehicleLabel'
import { type Board, type Move, parseBoard } from './domain/board'
import { getLevel } from './domain/levels'
import { solve } from './domain/solver'
import RushHourGame from './RushHourGame'

afterEach(cleanup)

const game = { slug: 'rush-hour', scoreLimits: { max: 20000 } }
const player = { id: 'p1', username: 'tanguy' }

// Les tests jouent la solution du solveur : ils ne dépendent pas du dessin du niveau 1.
const LEVEL_1: Board = parseBoard(getLevel(1).map)
const SOLUTION = solve(LEVEL_1)!
const OPTIMAL = SOLUTION.length

/** Le jeu branché sur le vrai GameContext de la plateforme, avec ses fakes en mémoire (aucun réseau). */
function renderGame() {
  const scores = new FakeScores(player)
  render(<RushHourGame ctx={createGameContext(game, player, fakeDeps({ scores }))} />)
  return { scores, user: userEvent.setup() }
}

function labelOf(id: string) {
  return vehicleLabel(LEVEL_1.vehicles.find((v) => v.id === id)!)
}

/** Flèches à presser pour jouer un coup au clavier (une flèche = une case). */
function keysFor(move: Move) {
  const horizontal = LEVEL_1.vehicles.find((v) => v.id === move.id)!.orientation === 'H'
  const key = horizontal ? (move.delta > 0 ? 'ArrowRight' : 'ArrowLeft') : move.delta > 0 ? 'ArrowDown' : 'ArrowUp'
  return `{${key}}`.repeat(Math.abs(move.delta))
}

async function playKeys(user: ReturnType<typeof userEvent.setup>, move: Move, keys = keysFor(move)) {
  screen.getByRole('button', { name: labelOf(move.id) }).focus()
  await user.keyboard(keys)
}

const counter = (moves: number) => screen.getByText(`Coups : ${moves} (min. ${OPTIMAL})`)

describe('RushHourGame : le niveau 1 se joue au clavier', () => {
  test('affiche le niveau 1, tous ses véhicules et le compteur de coups', () => {
    // Act
    renderGame()

    // Assert
    expect(screen.getByRole('heading', { name: 'Niveau 1' })).toBeInTheDocument()
    for (const v of LEVEL_1.vehicles) expect(screen.getByRole('button', { name: vehicleLabel(v) })).toBeInTheDocument()
    expect(counter(0)).toBeInTheDocument()
  })

  test('une flèche dans le sens du véhicule le déplace et compte un coup', async () => {
    // Arrange
    const { user } = renderGame()
    const first = SOLUTION[0]

    // Act : une seule case dans le sens du premier coup de la solution
    await playKeys(user, first, keysFor({ ...first, delta: Math.sign(first.delta) }))

    // Assert
    expect(counter(1)).toBeInTheDocument()
  })

  test('une flèche dans l’autre axe ne fait rien', async () => {
    // Arrange
    const { user } = renderGame()

    // Act : la voiture rouge est horizontale
    await playKeys(user, { id: 'X', delta: 0 }, '{ArrowUp}')

    // Assert
    expect(counter(0)).toBeInTheDocument()
  })

  test('Annuler est désactivé sans coup, puis annule le dernier coup', async () => {
    // Arrange
    const { user } = renderGame()
    expect(screen.getByRole('button', { name: 'Annuler' })).toBeDisabled()
    await playKeys(user, SOLUTION[0])

    // Act
    await user.click(screen.getByRole('button', { name: 'Annuler' }))

    // Assert
    expect(counter(0)).toBeInTheDocument()
  })

  test('Recommencer remet le compteur à zéro', async () => {
    // Arrange
    const { user } = renderGame()
    await playKeys(user, SOLUTION[0])

    // Act
    await user.click(screen.getByRole('button', { name: 'Recommencer' }))

    // Assert
    expect(counter(0)).toBeInTheDocument()
  })

  test('jouer la solution la plus courte gagne avec 1000 points, envoyés au classement', async () => {
    // Arrange
    const { user, scores } = renderGame()

    // Act
    for (const move of SOLUTION) await playKeys(user, move)

    // Assert
    expect(await screen.findByText(`Bravo ! 1000 points en ${OPTIMAL} coups`)).toBeInTheDocument()
    expect(scores.rows.map((r) => r.score)).toEqual([1000])
  })
})
